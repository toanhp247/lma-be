import type { Book, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const BORROW_DAYS = 14;

type QueryInput = Record<string, unknown>;
type UserBorrowInfo = { dueDate: string } | null;

type BookItemResponse = {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  status: "available" | "borrowed";
  dueDate?: string;
};

type BookDetailResponse = BookItemResponse & {
  description?: string;
  publisher?: string;
  publicationYear?: number;
  pageCount?: number;
  categories: string[];
  tags: string[];
  availableCopies: number;
  totalCopies: number;
  isUserBorrowed: boolean;
};

type ListBooksResponse = {
  data: BookItemResponse[];
  pagination: { total: number; page: number; totalPages: number };
};

function pickQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) return value[0];
  if (typeof value === "string") return value;
  return undefined;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const raw = pickQueryValue(value);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function computeDueDate(): string {
  const due = new Date();
  due.setDate(due.getDate() + BORROW_DAYS);
  return formatDate(due);
}

function buildBookItem(book: Book, userBorrow: UserBorrowInfo): BookItemResponse {
  const isUserBorrowed = Boolean(userBorrow);
  const status: "available" | "borrowed" =
    isUserBorrowed ? "borrowed" : book.availableCopies > 0 ? "available" : "borrowed";

  const item: BookItemResponse = {
    id: book.id,
    title: book.title,
    author: book.author,
    status,
  };

  if (book.coverUrl) item.coverUrl = book.coverUrl;
  if (userBorrow?.dueDate) item.dueDate = userBorrow.dueDate;

  return item;
}

function buildBookDetail(book: Book, userBorrow: UserBorrowInfo): BookDetailResponse {
  const isUserBorrowed = Boolean(userBorrow);
  const base = buildBookItem(book, userBorrow);
  const detail: BookDetailResponse = {
    ...base,
    categories: normalizeStringArray(book.categories),
    tags: normalizeStringArray(book.tags),
    availableCopies: book.availableCopies,
    totalCopies: book.totalCopies,
    isUserBorrowed,
  };

  if (book.description) detail.description = book.description;
  if (book.publisher) detail.publisher = book.publisher;
  if (book.publicationYear !== null && book.publicationYear !== undefined) {
    detail.publicationYear = book.publicationYear;
  }
  if (book.pageCount !== null && book.pageCount !== undefined) {
    detail.pageCount = book.pageCount;
  }

  return detail;
}

async function ensureUser(userId?: string) {
  if (!userId) throw new AppError(401, "AUTH_001", "Unauthorized");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(401, "AUTH_001", "Unauthorized");
  return user;
}

export const libraryService = {
  async listBooks(userId: string | undefined, query: QueryInput): Promise<ListBooksResponse> {
    await ensureUser(userId);

    const page = parsePositiveInt(query.page, DEFAULT_PAGE);
    const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT);
    const search = pickQueryValue(query.search)?.trim();
    const tab = pickQueryValue(query.tab) ?? "all";

    const where: Prisma.BookWhereInput = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { author: { contains: search, mode: "insensitive" } },
      ];
    }

    if (tab === "available") {
      where.availableCopies = { gt: 0 };
    }

    const total = await prisma.book.count({ where });
    const books = await prisma.book.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { title: "asc" },
    });

    const bookIds = books.map((book) => book.id);
    const userBorrows = bookIds.length
      ? await prisma.borrow.findMany({
          where: { userId, bookId: { in: bookIds }, returnedAt: null },
          select: { bookId: true, dueDate: true },
        })
      : [];

    const borrowMap = new Map<string, { dueDate: string }>();
    for (const borrow of userBorrows) {
      borrowMap.set(borrow.bookId, { dueDate: borrow.dueDate });
    }

    return {
      data: books.map((book) => buildBookItem(book, borrowMap.get(book.id) ?? null)),
      pagination: {
        total,
        page,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  },

  async getBookDetail(userId: string | undefined, bookId: string): Promise<BookDetailResponse> {
    await ensureUser(userId);

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new AppError(404, "BOOK_404", "Book not found");

    const userBorrow = await prisma.borrow.findFirst({
      where: { userId, bookId, returnedAt: null },
      select: { dueDate: true },
    });

    return buildBookDetail(book, userBorrow);
  },

  async borrowBook(
    userId: string | undefined,
    bookId: string
  ): Promise<{ success: boolean; dueDate: string; message: string }> {
    await ensureUser(userId);

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new AppError(400, "LIB_003", "Book not found");

    const existingBorrow = await prisma.borrow.findFirst({
      where: { userId, bookId, returnedAt: null },
      select: { id: true },
    });
    if (existingBorrow) throw new AppError(400, "LIB_001", "User already borrowed this book");

    if (book.availableCopies <= 0) {
      throw new AppError(400, "LIB_002", "Book is not available");
    }

    const dueDate = computeDueDate();

    await prisma.$transaction(async (tx) => {
      const updated = await tx.book.updateMany({
        where: { id: bookId, availableCopies: { gt: 0 } },
        data: { availableCopies: { decrement: 1 } },
      });

      if (updated.count === 0) {
        throw new AppError(400, "LIB_002", "Book is not available");
      }

      await tx.borrow.create({
        data: { userId: userId as string, bookId, dueDate },
      });
    });

    return { success: true, dueDate, message: "Borrow succeeded" };
  },
};
