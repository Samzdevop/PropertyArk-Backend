import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateUserCompanyNames() {
  try {
    console.log('Starting companyName migration...');

    // Get all admins with companyName
    const adminsWithCompany = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        companyName: { not: null }
      },
      select: {
        id: true,
        companyName: true,
        email: true
      }
    });

    console.log(`Found ${adminsWithCompany.length} admins with companyName`);

    let updatedCount = 0;

    // For each admin, update their company users
    for (const admin of adminsWithCompany) {
      // Find users created by this admin (you might need to track creatorId)
      // Since we don't have creatorId, we'll update users with the same email domain as a heuristic
      if (!admin.email) {
        console.warn(`Skipping admin ${admin.id} because email is null`);
        continue;
      }
      const adminDomain = admin.email.split('@')[1];
      
      const usersToUpdate = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: adminDomain } },
            // Or update all non-admin users in the system to this admin's company
            { role: { in: ['FARM_KEEPER', 'COWORKER'] } }
          ],
          companyName: null
        }
      });

      if (usersToUpdate.length > 0) {
        await prisma.user.updateMany({
          where: {
            id: { in: usersToUpdate.map(user => user.id) }
          },
          data: {
            companyName: admin.companyName
          }
        });
        updatedCount += usersToUpdate.length;
        console.log(`Updated ${usersToUpdate.length} users for admin ${admin.email}`);
      }
    }

    console.log(`Migration completed. Updated ${updatedCount} users.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
updateUserCompanyNames();