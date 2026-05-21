import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { TAXONOMY } from './taxonomy';

type AdminSeed = { email: string; name: string; password: string };

const argonOpts = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

const DEMO_PASSWORD = 'demo1234';
const DEMO_BIDDER_COUNT = 10;

function readAdmins(): AdminSeed[] {
  const json = process.env.SEED_ADMINS;
  if (json) {
    const parsed = JSON.parse(json) as AdminSeed[];
    if (!Array.isArray(parsed)) throw new Error('SEED_ADMINS must be a JSON array');
    return parsed;
  }
  return [
    {
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@auctionit.ai',
      name: process.env.SEED_ADMIN_NAME ?? 'Auction Admin',
      password: process.env.SEED_ADMIN_PASSWORD ?? 'changeme123',
    },
  ];
}

async function seedAdmins(prisma: PrismaClient) {
  const admins = readAdmins();
  for (const admin of admins) {
    if (admin.password.length < 8) {
      throw new Error(`password for ${admin.email} must be at least 8 chars`);
    }
    const passwordHash = await hash(admin.password, argonOpts);
    const result = await prisma.user.upsert({
      where: { email: admin.email },
      update: { passwordHash, role: 'admin', name: admin.name },
      create: { email: admin.email, name: admin.name, passwordHash, role: 'admin' },
    });
    console.log(`seeded admin: ${result.email}`);
  }
}

// Upserts the full Category > Subcategory > Microcategory taxonomy. Positions
// are assigned in the order they appear in `taxonomy.ts`, so the business team
// can reorder by editing that file.
async function seedTaxonomy(prisma: PrismaClient) {
  const catPos = new Map<string, number>();
  const subPos = new Map<string, number>(); // key: `${categoryName}::${subName}`
  const microPos = new Map<string, number>(); // key: `${categoryName}::${subName}::${microName}`

  for (const [cat, sub, micro] of TAXONOMY) {
    if (!catPos.has(cat)) catPos.set(cat, catPos.size + 1);
    const subKey = `${cat}::${sub}`;
    if (!subPos.has(subKey)) subPos.set(subKey, subPos.size + 1);
    const microKey = `${subKey}::${micro}`;
    if (!microPos.has(microKey)) microPos.set(microKey, microPos.size + 1);
  }

  // Categories
  const catIdByName = new Map<string, string>();
  for (const [name, position] of catPos) {
    const row = await prisma.category.upsert({
      where: { name },
      update: { position },
      create: { name, position },
    });
    catIdByName.set(name, row.id);
  }

  // Subcategories
  const subIdByKey = new Map<string, string>();
  for (const [key, position] of subPos) {
    const [catName, subName] = key.split('::');
    const categoryId = catIdByName.get(catName);
    if (!categoryId) throw new Error(`missing category ${catName}`);
    const row = await prisma.subcategory.upsert({
      where: { categoryId_name: { categoryId, name: subName } },
      update: { position },
      create: { categoryId, name: subName, position },
    });
    subIdByKey.set(key, row.id);
  }

  // Microcategories
  for (const [key, position] of microPos) {
    const [catName, subName, microName] = key.split('::');
    const subcategoryId = subIdByKey.get(`${catName}::${subName}`);
    if (!subcategoryId) throw new Error(`missing subcategory ${catName}::${subName}`);
    await prisma.microcategory.upsert({
      where: { subcategoryId_name: { subcategoryId, name: microName } },
      update: { position },
      create: { subcategoryId, name: microName, position },
    });
  }

  console.log(
    `seeded taxonomy: ${catPos.size} categories · ${subPos.size} subcategories · ${microPos.size} microcategories`,
  );
}

async function seedDemo(prisma: PrismaClient) {
  const passwordHash = await hash(DEMO_PASSWORD, argonOpts);

  // Pick three real microcategories from the taxonomy for the demo lots.
  const DEMO_LOT_SPECS: { category: string; sub: string; micro: string; hsn: string }[] = [
    { category: 'MS Scrap', sub: 'MS Melting Scrap', micro: 'Heavy Scrap', hsn: '7204' },
    { category: 'Cast Iron & DI', sub: 'Cast Iron', micro: 'CI Scrap', hsn: '7204' },
    { category: 'MS Scrap', sub: 'MS Process Scrap', micro: 'Turning/Boring/Chips', hsn: '7204' },
  ];

  await prisma.attribute.upsert({
    where: { name: 'Grade' },
    update: {},
    create: { name: 'Grade', type: 'text' },
  });

  const lotSpecs: {
    microcategoryId: string;
    itemName: string;
    hsnCode: string;
  }[] = [];
  for (const spec of DEMO_LOT_SPECS) {
    const micro = await prisma.microcategory.findFirst({
      where: {
        name: spec.micro,
        subcategory: { name: spec.sub, category: { name: spec.category } },
      },
      select: { id: true },
    });
    if (!micro) {
      throw new Error(`demo microcategory not found: ${spec.category} > ${spec.sub} > ${spec.micro}`);
    }
    lotSpecs.push({
      microcategoryId: micro.id,
      itemName: `${spec.micro} (Demo)`,
      hsnCode: spec.hsn,
    });
  }

  const client = await prisma.client.upsert({
    where: { pan: 'AABCD1234E' },
    update: {},
    create: {
      companyName: 'Demo Steel Works Pvt Ltd',
      phone: '+912212345678',
      registeredAddress: '101 Industrial Estate, Andheri East, Mumbai 400093',
      country: 'India',
      pan: 'AABCD1234E',
      tan: 'MUMA12345B',
      tin: '27AABCD1234E1Z5',
      revenueRate: 200,
      isActive: true,
    },
  });

  let location = await prisma.clientLocation.findFirst({
    where: { clientId: client.id, name: 'Mumbai Plant' },
  });
  if (!location) {
    location = await prisma.clientLocation.create({
      data: {
        clientId: client.id,
        name: 'Mumbai Plant',
        addressLine: '101 Industrial Estate, Andheri East',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400093',
        country: 'India',
        isPrimary: true,
      },
    });
  }
  const existingContact = await prisma.clientContactPoint.findFirst({
    where: { locationId: location.id, name: 'Ravi Kumar' },
  });
  if (!existingContact) {
    await prisma.clientContactPoint.create({
      data: {
        locationId: location.id,
        name: 'Ravi Kumar',
        role: 'Plant Manager',
        email: 'ravi@demo-steel.local',
        phone: '+919800000001',
      },
    });
  }

  for (let i = 1; i <= DEMO_BIDDER_COUNT; i++) {
    const num = String(i).padStart(2, '0');
    const email = `bidder${num}@demo.local`;
    const name = `Demo Bidder ${num}`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, role: 'bidder' },
      create: { email, name, passwordHash, role: 'bidder' },
    });
    const profile = await prisma.bidderProfile.upsert({
      where: { userId: user.id },
      update: { status: 'approved' },
      create: {
        userId: user.id,
        interestedIn: 'both',
        fullName: name,
        contactCountryCode: '+91',
        contactNumber: `90000000${num}`,
        whatsappCountryCode: '+91',
        whatsappNumber: `90000000${num}`,
        companyName: `Bidder ${num} Trading Co`,
        status: 'approved',
        submittedAt: new Date(),
        approvedAt: new Date(),
      },
    });
    await prisma.bidderWallet.upsert({
      where: { bidderProfileId: profile.id },
      update: {},
      create: {
        bidderProfileId: profile.id,
        balance: 10_000_000,
      },
    });
  }

  const auctionCode = 'DEMO-AUC-001';
  const auction = await prisma.auction.upsert({
    where: { code: auctionCode },
    update: {},
    create: {
      clientId: client.id,
      locationId: location.id,
      code: auctionCode,
      name: 'Demo Ferrous Scrap Auction',
      auctionType: 'forward',
      status: 'draft',
      description: 'Seeded demo auction',
    },
  });

  const baseStart = new Date();
  baseStart.setDate(baseStart.getDate() + 1);
  baseStart.setHours(11, 0, 0, 0);
  for (let i = 0; i < lotSpecs.length; i++) {
    const lotNo = i + 1;
    const spec = lotSpecs[i];
    const startTime = new Date(baseStart.getTime() + i * 30 * 60_000);
    const endTime = new Date(startTime.getTime() + 30 * 60_000);
    await prisma.lot.upsert({
      where: { auctionId_lotNo: { auctionId: auction.id, lotNo } },
      update: {},
      create: {
        auctionId: auction.id,
        lotNo,
        microcategoryId: spec.microcategoryId,
        itemName: spec.itemName,
        qty: new Prisma.Decimal(50),
        uom: 'MT',
        hsnCode: spec.hsnCode,
        auctionDate: startTime,
        startTime,
        endTime,
        startingPriceCents: 2_500_000,
        bidIncrementCents: 10_000,
        emdAmount: 1_000_000,
      },
    });
  }

  console.log(
    `seeded demo: client=${client.companyName}, bidders=${DEMO_BIDDER_COUNT}, lots=${lotSpecs.length} (password: ${DEMO_PASSWORD})`,
  );
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedAdmins(prisma);
    await seedTaxonomy(prisma);
    if (process.env.SEED_DEMO === '1') {
      await seedDemo(prisma);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
