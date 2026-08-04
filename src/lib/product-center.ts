import { UserStatus } from "@prisma/client";
import { getPrisma } from "@/lib/prisma";
import type { ProductRow } from "@/lib/crm-data";
import type { Role } from "@/lib/utils";

export type ProductActor = {
  id: string;
  role: Role;
  name?: string;
};

export type ProductInput = {
  name: string;
  category: string;
  brand?: string;
  price: number;
  imageUrl?: string;
  description?: string;
  specification?: string;
  status?: UserStatus;
};

type ProductRecord = {
  id: string;
  name: string;
  category: string;
  brand: string | null;
  price: unknown;
  imageUrl: string | null;
  description: string | null;
  specification: string | null;
  status: UserStatus;
};

const productSelect = {
  id: true,
  name: true,
  category: true,
  brand: true,
  price: true,
  imageUrl: true,
  description: true,
  specification: true,
  status: true,
} as const;

export class ProductInputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProductInputError";
    this.status = status;
  }
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function ensureProductManageAccess(actor: ProductActor) {
  if (!["ADMIN", "SUPERVISOR"].includes(actor.role)) {
    throw new ProductInputError("Only admin and supervisor can manage products.", 403);
  }
}

function validateProductInput(input: ProductInput) {
  const name = normalizeText(input.name);
  const category = normalizeText(input.category || "General");
  const price = Number(input.price);

  if (!name) {
    throw new ProductInputError("Product name is required.");
  }

  if (!Number.isFinite(price) || price < 0) {
    throw new ProductInputError("Valid price is required.");
  }

  return {
    name,
    category,
    brand: input.brand?.trim() || undefined,
    price,
    imageUrl: input.imageUrl?.trim() || undefined,
    description: input.description?.trim() || undefined,
    specification: input.specification?.trim() || undefined,
    status: input.status,
  };
}

function mapProductRow(product: ProductRecord): ProductRow {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    brand: product.brand ?? "-",
    price: Number(product.price),
    imageUrl: product.imageUrl ?? "",
    description: product.description ?? "-",
    specification: product.specification ?? "-",
    status: product.status === "ACTIVE" ? "Active" : "Inactive",
    interestedCustomers: 0,
    communicationCount: 0,
    followUpCount: 0,
    quotationCount: 0,
    salesCount: 0,
    conversionRate: 0,
    assignedCount: 0,
    assignedMarketers: [],
    targetCompanies: 0,
    contactedCompanies: 0,
    remainingCompanies: 0,
  };
}

async function addProductActivity(input: {
  userId: string;
  title: string;
  description: string;
  productId: string;
}) {
  const prisma = getPrisma();
  await prisma.activityTimeline.create({
    data: {
      title: input.title,
      description: input.description,
      entity: "ProductService",
      entityId: input.productId,
      userId: input.userId,
    },
  });
  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      action: input.title,
      entity: "ProductService",
      entityId: input.productId,
    },
  });
}

export async function listProducts() {
  const prisma = getPrisma();
  return prisma.productService.findMany({
    select: productSelect,
    orderBy: { name: "asc" },
  });
}

export async function getProductById(id: string) {
  const prisma = getPrisma();
  return prisma.productService.findUnique({
    where: { id },
    select: productSelect,
  });
}

export async function createProductEntry(actor: ProductActor, input: ProductInput) {
  ensureProductManageAccess(actor);
  const prisma = getPrisma();
  const data = validateProductInput(input);

  const product = await prisma.productService.create({
    data: {
      ...data,
      status: data.status ?? "ACTIVE",
    },
    select: productSelect,
  });

  await addProductActivity({
    userId: actor.id,
    title: "Product Created",
    description: product.name,
    productId: product.id,
  });

  return {
    product,
    row: mapProductRow(product),
  };
}

export async function updateProductEntry(actor: ProductActor, id: string, input: ProductInput) {
  ensureProductManageAccess(actor);
  const prisma = getPrisma();
  const data = validateProductInput(input);

  const existing = await prisma.productService.findUnique({
    where: { id },
    select: { id: true, name: true, status: true },
  });

  if (!existing) {
    throw new ProductInputError("Product not found.", 404);
  }

  const product = await prisma.productService.update({
    where: { id },
    data: {
      ...data,
      status: data.status ?? existing.status,
    },
    select: productSelect,
  });

  await addProductActivity({
    userId: actor.id,
    title: "Product Updated",
    description: `${existing.name} updated`,
    productId: product.id,
  });

  return {
    product,
    row: mapProductRow(product),
  };
}

export async function deleteProductEntry(actor: ProductActor, id: string) {
  ensureProductManageAccess(actor);
  const prisma = getPrisma();

  const existing = await prisma.productService.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!existing) {
    throw new ProductInputError("Product not found.", 404);
  }

  await prisma.$transaction([
    prisma.lead.updateMany({
      where: { productInterestId: id },
      data: { productInterestId: null },
    }),
    prisma.task.updateMany({
      where: { productId: id },
      data: { productId: null },
    }),
    prisma.todayPlan.updateMany({
      where: { productId: id },
      data: { productId: null },
    }),
    prisma.quotationItem.updateMany({
      where: { productId: id },
      data: { productId: null },
    }),
    prisma.attachment.updateMany({
      where: { productId: id },
      data: { productId: null },
    }),
    prisma.productInterest.deleteMany({
      where: { productId: id },
    }),
    prisma.productService.delete({
      where: { id },
    }),
  ]);

  await addProductActivity({
    userId: actor.id,
    title: "Product Deleted",
    description: existing.name,
    productId: existing.id,
  });

  return { id: existing.id, name: existing.name };
}
