import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductInput } from "@/lib/product-center";

type ProductBody = {
  name?: string;
  category?: string;
  brand?: string;
  price?: number | string;
  imageUrl?: string;
  description?: string;
  specification?: string;
  status?: "ACTIVE" | "INACTIVE";
};

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

function readFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseStatus(value?: string) {
  return value === "INACTIVE" ? "INACTIVE" : value === "ACTIVE" ? "ACTIVE" : undefined;
}

function sanitizeFileStem(name: string) {
  const stem = name.replace(/\.[^.]+$/, "").trim().toLowerCase();
  const normalized = stem.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "product";
}

async function saveProductImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose a valid image file.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads", "products");
  await mkdir(uploadsDir, { recursive: true });

  const derivedExtension = path.extname(file.name).toLowerCase();
  const extension = IMAGE_EXTENSIONS[file.type] ?? (derivedExtension || ".img");
  const fileName = `${sanitizeFileStem(file.name)}-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(path.join(uploadsDir, fileName), buffer);
  return `/uploads/products/${fileName}`;
}

export async function parseProductInputRequest(request: Request): Promise<ProductInput> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const imageEntry = formData.get("image");
    let imageUrl = readFormText(formData, "existingImageUrl");

    if (imageEntry instanceof File && imageEntry.size > 0) {
      imageUrl = await saveProductImage(imageEntry);
    }

    return {
      name: readFormText(formData, "name") ?? "",
      category: readFormText(formData, "category") ?? "",
      brand: readFormText(formData, "brand"),
      price: Number(readFormText(formData, "price") ?? 0),
      imageUrl,
      description: readFormText(formData, "description"),
      specification: readFormText(formData, "specification"),
      status: parseStatus(readFormText(formData, "status")),
    };
  }

  const body = (await request.json()) as ProductBody;
  return {
    name: body.name?.trim() ?? "",
    category: body.category?.trim() ?? "",
    brand: body.brand?.trim(),
    price: Number(body.price),
    imageUrl: body.imageUrl?.trim(),
    description: body.description?.trim(),
    specification: body.specification?.trim(),
    status: body.status,
  };
}
