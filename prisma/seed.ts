import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { slugify } from "../lib/utils";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in .env");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.orderItemSelection.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.orderRevision.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.sheetSyncLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.optionChoice.deleteMany();
  await prisma.optionGroup.deleteMany();
  await prisma.product.deleteMany();
  await prisma.leather.deleteMany();

  await prisma.leather.createMany({
    data: [
      {
        name: "Mustang",
        slug: "mustang",
        grade: "Grade A",
        imageUrl: null,
        active: true,
      },
      {
        name: "Dakota Black",
        slug: "dakota-black",
        grade: "Grade A",
        imageUrl: null,
        active: true,
      },
      {
        name: "Dakota Brown",
        slug: "dakota-brown",
        grade: "Grade A",
        imageUrl: null,
        active: true,
      },
      {
        name: "Brompton Tan",
        slug: "brompton-tan",
        grade: "Grade B",
        imageUrl: null,
        active: true,
      },
    ],
  });

  const productName = "Custom Barstool";

  const product = await prisma.product.create({
    data: {
      name: productName,
      slug: slugify(productName),
      description: "Custom barstool with admin-managed builder options.",
      sku: "BARSTOOL-001",
      basePrice: new Prisma.Decimal(450),
      active: true,
      optionGroups: {
        create: [
          {
            name: "Inside Back",
            slug: "inside-back",
            type: "SINGLE_SELECT",
            required: true,
            displayOrder: 1,
            choices: {
              create: [
                {
                  label: "Yoke",
                  value: "yoke",
                  description: "Classic yoke style inside back.",
                  imageUrl: null,
                  priceDelta: new Prisma.Decimal(0),
                  usesLeatherGrades: true,
                  gradeAUpcharge: new Prisma.Decimal(20),
                  gradeBUpcharge: new Prisma.Decimal(35),
                  gradeEMBUpcharge: new Prisma.Decimal(45),
                  gradeHOHUpcharge: new Prisma.Decimal(50),
                  gradeAxisUpcharge: new Prisma.Decimal(55),
                  gradeBuffaloUpcharge: new Prisma.Decimal(65),
                  comUpcharge: new Prisma.Decimal(0),
                  displayOrder: 1,
                },
                {
                  label: "Quilted",
                  value: "quilted",
                  description: "Quilted inside back pattern.",
                  imageUrl: null,
                  priceDelta: new Prisma.Decimal(35),
                  usesLeatherGrades: true,
                  gradeAUpcharge: new Prisma.Decimal(35),
                  gradeBUpcharge: new Prisma.Decimal(50),
                  gradeEMBUpcharge: new Prisma.Decimal(60),
                  gradeHOHUpcharge: new Prisma.Decimal(65),
                  gradeAxisUpcharge: new Prisma.Decimal(70),
                  gradeBuffaloUpcharge: new Prisma.Decimal(80),
                  comUpcharge: new Prisma.Decimal(0),
                  displayOrder: 2,
                },
                {
                  label: "Tufted",
                  value: "tufted",
                  description: "Tufted inside back pattern.",
                  imageUrl: null,
                  priceDelta: new Prisma.Decimal(60),
                  usesLeatherGrades: true,
                  gradeAUpcharge: new Prisma.Decimal(50),
                  gradeBUpcharge: new Prisma.Decimal(70),
                  gradeEMBUpcharge: new Prisma.Decimal(80),
                  gradeHOHUpcharge: new Prisma.Decimal(85),
                  gradeAxisUpcharge: new Prisma.Decimal(90),
                  gradeBuffaloUpcharge: new Prisma.Decimal(100),
                  comUpcharge: new Prisma.Decimal(0),
                  displayOrder: 3,
                },
              ],
            },
          },
          {
            name: "Outside Back",
            slug: "outside-back",
            type: "SINGLE_SELECT",
            required: true,
            displayOrder: 2,
            choices: {
              create: [
                {
                  label: "Plain",
                  value: "plain",
                  description: "Plain outside back.",
                  imageUrl: null,
                  priceDelta: new Prisma.Decimal(0),
                  usesLeatherGrades: false,
                  displayOrder: 1,
                },
                {
                  label: "Quilted",
                  value: "quilted",
                  description: "Quilted outside back pattern.",
                  imageUrl: null,
                  priceDelta: new Prisma.Decimal(30),
                  usesLeatherGrades: true,
                  gradeAUpcharge: new Prisma.Decimal(25),
                  gradeBUpcharge: new Prisma.Decimal(40),
                  gradeEMBUpcharge: new Prisma.Decimal(50),
                  gradeHOHUpcharge: new Prisma.Decimal(55),
                  gradeAxisUpcharge: new Prisma.Decimal(60),
                  gradeBuffaloUpcharge: new Prisma.Decimal(70),
                  comUpcharge: new Prisma.Decimal(0),
                  displayOrder: 2,
                },
                {
                  label: "Tufted",
                  value: "tufted",
                  description: "Tufted outside back pattern.",
                  imageUrl: null,
                  priceDelta: new Prisma.Decimal(50),
                  usesLeatherGrades: true,
                  gradeAUpcharge: new Prisma.Decimal(40),
                  gradeBUpcharge: new Prisma.Decimal(60),
                  gradeEMBUpcharge: new Prisma.Decimal(70),
                  gradeHOHUpcharge: new Prisma.Decimal(75),
                  gradeAxisUpcharge: new Prisma.Decimal(80),
                  gradeBuffaloUpcharge: new Prisma.Decimal(90),
                  comUpcharge: new Prisma.Decimal(0),
                  displayOrder: 3,
                },
              ],
            },
          },
          {
            name: "Arms",
            slug: "arms",
            type: "SINGLE_SELECT",
            required: false,
            displayOrder: 3,
            choices: {
              create: [
                {
                  label: "None",
                  value: "none",
                  description: "No arms.",
                  imageUrl: null,
                  priceDelta: new Prisma.Decimal(0),
                  usesLeatherGrades: false,
                  displayOrder: 1,
                },
                {
                  label: "Straight",
                  value: "straight",
                  description: "Straight arm style.",
                  imageUrl: null,
                  priceDelta: new Prisma.Decimal(45),
                  usesLeatherGrades: true,
                  gradeAUpcharge: new Prisma.Decimal(15),
                  gradeBUpcharge: new Prisma.Decimal(25),
                  gradeEMBUpcharge: new Prisma.Decimal(30),
                  gradeHOHUpcharge: new Prisma.Decimal(35),
                  gradeAxisUpcharge: new Prisma.Decimal(40),
                  gradeBuffaloUpcharge: new Prisma.Decimal(50),
                  comUpcharge: new Prisma.Decimal(0),
                  displayOrder: 2,
                },
                {
                  label: "Rolled",
                  value: "rolled",
                  description: "Rolled arm style.",
                  imageUrl: null,
                  priceDelta: new Prisma.Decimal(55),
                  usesLeatherGrades: true,
                  gradeAUpcharge: new Prisma.Decimal(20),
                  gradeBUpcharge: new Prisma.Decimal(30),
                  gradeEMBUpcharge: new Prisma.Decimal(35),
                  gradeHOHUpcharge: new Prisma.Decimal(40),
                  gradeAxisUpcharge: new Prisma.Decimal(45),
                  gradeBuffaloUpcharge: new Prisma.Decimal(55),
                  comUpcharge: new Prisma.Decimal(0),
                  displayOrder: 3,
                },
              ],
            },
          },
          {
            name: "Nails",
            slug: "nails",
            type: "SINGLE_SELECT",
            required: false,
            displayOrder: 4,
            choices: {
              create: [
                {
                  label: "None",
                  value: "none",
                  description: "No nails.",
                  imageUrl: null,
                  priceDelta: new Prisma.Decimal(0),
                  usesLeatherGrades: false,
                  displayOrder: 1,
                },
                {
                  label: "Antique Brass",
                  value: "antique-brass",
                  description: "Antique brass nail finish.",
                  imageUrl: null,
                  priceDelta: new Prisma.Decimal(18),
                  usesLeatherGrades: false,
                  displayOrder: 2,
                },
                {
                  label: "Black Nickel",
                  value: "black-nickel",
                  description: "Black nickel nail finish.",
                  imageUrl: null,
                  priceDelta: new Prisma.Decimal(22),
                  usesLeatherGrades: false,
                  displayOrder: 3,
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(`Seeded product: ${product.name}`);
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });