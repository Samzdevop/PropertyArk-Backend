"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function updateUserCompanyNames() {
    try {
        console.log('Starting companyName migration...');
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
        for (const admin of adminsWithCompany) {
            if (!admin.email) {
                console.warn(`Skipping admin ${admin.id} because email is null`);
                continue;
            }
            const adminDomain = admin.email.split('@')[1];
            const usersToUpdate = await prisma.user.findMany({
                where: {
                    OR: [
                        { email: { contains: adminDomain } },
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
    }
    catch (error) {
        console.error('Migration failed:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
updateUserCompanyNames();
