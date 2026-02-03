"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllVets = exports.getFarmDetails = exports.getVetAssignedFarms = exports.updateUserAvatar = exports.adminUpdateUser = exports.updateUserProfile = exports.deleteUser = exports.getUserById = exports.getAllUsers = exports.getProfile = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const selects_1 = require("../prisma/selects");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const phoneFormat_1 = require("../utils/phoneFormat");
const BadRequestError_1 = require("../errors/BadRequestError");
const vet_helpers_1 = require("../helpers/vet.helpers");
const upload_1 = require("../config/upload");
// import { Prisma } from '@prisma/client';
const getProfile = async (req, res, next) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.user.id },
            select: selects_1.userSelect
        });
        if (!user)
            throw new NotFoundError_1.NotFoundError('User not found');
        // user.password = '';
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Profile successfully retrieved', user);
    }
    catch (error) {
        next(error);
    }
};
exports.getProfile = getProfile;
// export const updateProfile = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const userId = (req.user as any).id;
//     const { fullName, location, avatar, phone } = req.body;
//     if (phone && !validatePhoneNumber(phone)) {
//       throw new BadRequestError(
//         'Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)'
//       );
//     }
//     const normalizedPhone = phone ? normalizePhoneNumber(phone) : undefined;
//     const updatedUser = await prisma.user.update({
//       where: { id: userId },
//       data: { fullName, location, avatar, phone:normalizedPhone },
//       select: userSelect
//     });
//     sendSuccessResponse(res, 'Profile updated successfully', updatedUser);
//   } catch (error) {
//     next(error);
//   }
// };
const getAllUsers = async (req, res, next) => {
    try {
        const requestingUser = req.user;
        const { page = 1, limit = 10 } = req.query;
        const currentUser = req.user;
        // Determine which roles the current user can access
        let allowedRoles = [];
        if (requestingUser.role === 'ADMIN') {
            allowedRoles = ['FARM_KEEPER', 'COWORKER'];
        }
        else if (requestingUser.role === 'FARM_KEEPER') {
            allowedRoles = ['COWORKER'];
        }
        else {
            throw new ForbiddenError_1.ForbiddenError('You do not have permission to view users');
        }
        const where = {
            role: { in: allowedRoles },
            id: { not: requestingUser.id }
        };
        const [users, total] = await Promise.all([
            prisma_1.default.user.findMany({
                where: {
                    companyId: currentUser.companyId,
                    ...where
                },
                skip: (Number(page) - 1) * Number(limit),
                take: Number(limit),
                select: selects_1.userSelect,
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.default.user.count({ where })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Users retrieved successfully', {
            users,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllUsers = getAllUsers;
const getUserById = async (req, res, next) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.params.userId },
            select: selects_1.userSelect
        });
        if (!user)
            throw new NotFoundError_1.NotFoundError('User not found');
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'User retrieved successfully', user);
    }
    catch (error) {
        next(error);
    }
};
exports.getUserById = getUserById;
const deleteUser = async (req, res, next) => {
    try {
        const user = await prisma_1.default.user.findUnique({
            where: { id: req.params.userId }
        });
        if (!user)
            throw new NotFoundError_1.NotFoundError('User not found');
        await prisma_1.default.user.delete({
            where: { id: req.params.userId },
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'User permanently deleted successfully');
    }
    catch (error) {
        next(error);
    }
};
exports.deleteUser = deleteUser;
const updateUserProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { fullName, location, avatar, phone, companyName } = req.body;
        // Validate phone if provided
        if (phone && !(0, phoneFormat_1.validatePhoneNumber)(phone)) {
            throw new BadRequestError_1.BadRequestError('Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)');
        }
        const normalizedPhone = phone ? (0, phoneFormat_1.normalizePhoneNumber)(phone) : undefined;
        const updateData = {
            fullName,
            location,
            avatar,
            phone: normalizedPhone,
        };
        if (companyName && userRole === 'ADMIN') {
            updateData.companyName = companyName;
        }
        else if (companyName && userRole !== 'ADMIN') {
            throw new ForbiddenError_1.ForbiddenError('Only admin can update company name');
        }
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: updateData,
            select: selects_1.userSelect
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Profile updated successfully', updatedUser);
    }
    catch (error) {
        next(error);
    }
};
exports.updateUserProfile = updateUserProfile;
const adminUpdateUser = async (req, res, next) => {
    try {
        const adminId = req.user.id;
        const adminRole = req.user.role;
        const { userId } = req.params;
        const { fullName, location, avatar, phone, companyName, role, isSuspended } = req.body;
        // Check if user is admin
        if (adminRole !== 'ADMIN') {
            throw new ForbiddenError_1.ForbiddenError('Only admin can update other users');
        }
        const targetUser = await prisma_1.default.user.findUnique({
            where: { id: userId }
        });
        if (!targetUser) {
            throw new NotFoundError_1.NotFoundError('User not found');
        }
        if (phone && !(0, phoneFormat_1.validatePhoneNumber)(phone)) {
            throw new BadRequestError_1.BadRequestError('Phone must be in valid international format (+XXX...) or local Nigerian format (0XXX...)');
        }
        const normalizedPhone = phone ? (0, phoneFormat_1.normalizePhoneNumber)(phone) : undefined;
        const updateData = {
            ...(fullName && { fullName }),
            ...(location && { location }),
            ...(avatar && { avatar }),
            ...(phone && { phone: normalizedPhone }),
            ...(companyName && { companyName }),
            ...(role && { role }),
            ...(isSuspended !== undefined && { isSuspended }),
        };
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: updateData,
            select: selects_1.userSelect
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'User updated successfully', updatedUser);
    }
    catch (error) {
        next(error);
    }
};
exports.adminUpdateUser = adminUpdateUser;
const updateUserAvatar = async (req, res, next) => {
    try {
        const adminId = req.user.id;
        const adminRole = req.user.role;
        const { userId } = req.params;
        if (adminRole !== 'ADMIN') {
            throw new ForbiddenError_1.ForbiddenError('Only admin can update user avatars');
        }
        const targetUser = await prisma_1.default.user.findUnique({
            where: { id: userId }
        });
        if (!targetUser) {
            throw new NotFoundError_1.NotFoundError('User not found');
        }
        const file = req.file;
        if (!file) {
            throw new BadRequestError_1.BadRequestError('No avatar file uploaded');
        }
        const avatarUrl = (0, upload_1.getFileUrl)(file.filename);
        if (targetUser.avatar) {
            try {
                const oldFilename = targetUser.avatar.split('/').pop();
                if (oldFilename) {
                    await (0, upload_1.deleteFile)(oldFilename);
                }
            }
            catch (error) {
                console.error('Error deleting old avatar:', error);
            }
        }
        const updatedUser = await prisma_1.default.user.update({
            where: { id: userId },
            data: {
                avatar: avatarUrl,
                updatedAt: new Date()
            },
            select: selects_1.userSelect
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'User avatar updated successfully', updatedUser);
    }
    catch (error) {
        if (req.file) {
            await (0, upload_1.deleteFile)(req.file.filename);
        }
        next(error);
    }
};
exports.updateUserAvatar = updateUserAvatar;
const getVetAssignedFarms = async (req, res, next) => {
    try {
        const vetId = req.user.id;
        const vetRole = req.user.role;
        // Only vets can access this endpoint
        if (vetRole !== 'VET') {
            throw new ForbiddenError_1.ForbiddenError('Only vets can access assigned farms');
        }
        // Get distinct companies where the vet has tasks
        const assignedCompanies = await prisma_1.default.task.findMany({
            where: {
                assignedToId: vetId,
                assignedBy: {
                    companyName: { not: null }
                }
            },
            distinct: ['assignedById'],
            include: {
                assignedBy: {
                    select: {
                        ...selects_1.userSelect,
                        companyId: true
                    }
                }
            },
            orderBy: {
                assignedBy: {
                    companyName: 'asc'
                }
            }
        });
        // Extract unique companies
        const companies = assignedCompanies
            .map(task => task.assignedBy)
            .filter((company, index, self) => index === self.findIndex(c => c.companyName === company.companyName));
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Assigned farms retrieved successfully', {
            companies,
            total: companies.length
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getVetAssignedFarms = getVetAssignedFarms;
// export const getFarmDetails = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const vetId = (req.user as any).id;
//     const vetRole = (req.user as any).role;
//     const { companyId } = req.params;
//     // Only vets can access this endpoint
//     if (vetRole !== 'VET') {
//       throw new ForbiddenError('Only vets can access farm details');
//     }
//     // Verify the vet has tasks from this company
//     const hasAccess = await prisma.task.findFirst({
//       where: {
//         assignedToId: vetId,
//         assignedById: companyId
//       }
//     });
//     if (!hasAccess) {
//       throw new ForbiddenError('You do not have access to this farm');
//     }
//     // Get company admin details
//     const companyAdmin = await prisma.user.findUnique({
//       where: { id: companyId },
//       select: {
//         id: true,
//         fullName: true,
//         email: true,
//         phone: true,
//         companyName: true,
//         location: true,
//         avatar: true,
//         createdAt: true
//       }
//     });
//     if (!companyAdmin) {
//       throw new NotFoundError('Farm not found');
//     }
//     // Get farm staff (excluding coworkers for privacy)
//     const farmStaff = await prisma.user.findMany({
//       where: {
//         companyName: companyAdmin.companyName,
//         role: { in: ['ADMIN', 'FARM_KEEPER'] },
//         id: { not: companyId } // Exclude the admin we already have
//       },
//       select: {
//         id: true,
//         fullName: true,
//         role: true,
//         email: true,
//         location: true,
//         avatar: true,
//         lastLogin: true
//       },
//       orderBy: { role: 'asc' }
//     });
//     // CORRECTED: Get livestock statistics with proper aggregate
//     const livestockStats = await prisma.livestock.aggregate({
//       where: {
//         addedBy: {
//           companyName: companyAdmin.companyName
//         },
//         isDeleted: false
//       },
//       _count: {
//         _all: true // Count all records
//       },
//       _avg: {
//         weight: true
//       },
//       _min: {
//         weight: true
//       },
//       _max: {
//         weight: true
//       }
//     });
//     // CORRECTED: Get livestock by health status with proper grouping
//     const livestockByHealth = await prisma.livestock.groupBy({
//       by: ['healthStatus'],
//       where: {
//         addedBy: {
//           companyName: companyAdmin.companyName
//         },
//         isDeleted: false
//       },
//       _count: {
//         _all: true // Count all records in each group
//       }
//     });
//     // Get sickness statistics
//     const sicknessStats = await prisma.sickness.aggregate({
//       where: {
//         livestock: {
//           addedBy: {
//             companyName: companyAdmin.companyName
//           }
//         }
//       },
//       _count: {
//         _all: true
//       }
//     });
//     // Get treatment statistics
//     const treatmentStats = await prisma.treatment.aggregate({
//       where: {
//         livestock: {
//           addedBy: {
//             companyName: companyAdmin.companyName
//           }
//         }
//       },
//       _count: {
//         _all: true
//       }
//     });
//     // Get vaccination statistics
//     const vaccinationStats = await prisma.vaccination.aggregate({
//       where: {
//         livestock: {
//           addedBy: {
//             companyName: companyAdmin.companyName
//           }
//         }
//       },
//       _count: {
//         _all: true
//       }
//     });
//     // Get recent sickness cases
//     const recentSickness = await prisma.sickness.findMany({
//       where: {
//         livestock: {
//           addedBy: {
//             companyName: companyAdmin.companyName
//           }
//         }
//       },
//       include: {
//         livestock: {
//           select: {
//             id: true,
//             tagId: true,
//             type: true,
//             breed: true
//           }
//         },
//         recordedBy: {
//           select: {
//             id: true,
//             fullName: true,
//             role: true
//           }
//         },
//         treatments: {
//           orderBy: { dateOfTreatment: 'desc' },
//           take: 1,
//           include: {
//             recordedBy: {
//               select: {
//                 id: true,
//                 fullName: true,
//                 role: true
//               }
//             }
//           }
//         }
//       },
//       orderBy: { dateOfObservation: 'desc' },
//       take: 10
//     });
//     // Get upcoming vaccinations
//     const upcomingVaccinations = await prisma.vaccination.findMany({
//       where: {
//         livestock: {
//           addedBy: {
//             companyName: companyAdmin.companyName
//           }
//         },
//         nextDueDate: {
//           gte: new Date()
//         }
//       },
//       include: {
//         livestock: {
//           select: {
//             id: true,
//             tagId: true,
//             type: true
//           }
//         },
//         recordedBy: {
//           select: {
//             id: true,
//             fullName: true,
//             role: true
//           }
//         }
//       },
//       orderBy: { nextDueDate: 'asc' },
//       take: 10
//     });
//     // Get active tasks for this farm assigned to this vet
//     const activeTasks = await prisma.task.findMany({
//       where: {
//         assignedToId: vetId,
//         assignedById: companyId,
//         status: { in: ['PENDING', 'IN_PROGRESS'] }
//       },
//       include: {
//         livestock: {
//           select: {
//             id: true,
//             tagId: true,
//             type: true,
//             healthStatus: true
//           }
//         }
//       },
//       orderBy: { dueDate: 'asc' },
//       take: 10
//     });
//     // Format the statistics properly
//     const farmDetails = {
//       company: companyAdmin,
//       staff: farmStaff,
//       statistics: {
//         livestock: {
//           total: livestockStats._count._all,
//           averageWeight: livestockStats._avg.weight,
//           minWeight: livestockStats._min.weight,
//           maxWeight: livestockStats._max.weight,
//           healthBreakdown: livestockByHealth.map(item => ({
//             healthStatus: item.healthStatus,
//             count: item._count._all
//           }))
//         },
//         medical: {
//           totalSicknessCases: sicknessStats._count._all,
//           totalTreatments: treatmentStats._count._all,
//           totalVaccinations: vaccinationStats._count._all
//         },
//         tasks: {
//           activeTasks: activeTasks.length
//         }
//       },
//       recentSickness,
//       upcomingVaccinations,
//       activeTasks
//     };
//     sendSuccessResponse(res, 'Farm details retrieved successfully', farmDetails);
//   } catch (error) {
//     next(error);
//   }
// };
const getFarmDetails = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const { companyId } = req.params;
        console.log('🔐 User Info:', { userId, role, companyId });
        if (role !== 'VET' && role !== "ADMIN") {
            throw new ForbiddenError_1.ForbiddenError('Only vets and admins can access farm details');
        }
        const companyAdmin = await prisma_1.default.user.findFirst({
            where: {
                companyId: companyId,
                role: 'ADMIN'
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                companyName: true,
                location: true,
                avatar: true,
                createdAt: true,
                companyId: true
            }
        });
        if (!companyAdmin) {
            throw new NotFoundError_1.NotFoundError('Farm not found');
        }
        console.log('🏢 Company Admin:', {
            adminId: companyAdmin.id,
            companyId: companyAdmin.companyId,
            companyName: companyAdmin.companyName
        });
        let hasAccess = false;
        if (role === 'VET') {
            const task = await prisma_1.default.task.findFirst({
                where: {
                    assignedToId: userId,
                    assignedById: companyAdmin.id
                }
            });
            hasAccess = !!task;
        }
        if (role === 'ADMIN') {
            const currentUser = await prisma_1.default.user.findUnique({
                where: { id: userId },
                select: { companyId: true, companyName: true }
            });
            hasAccess = currentUser?.companyId === companyId;
            // console.log('👑 ADMIN Access:', {
            //   hasAccess,
            //   userCompanyId: currentUser?.companyId,
            //   targetCompanyId: companyId,
            //   sameCompany: currentUser?.companyId === companyId
            // });
        }
        if (!hasAccess) {
            throw new ForbiddenError_1.ForbiddenError('You do not have access to this farm');
        }
        // Get farm staff
        const farmStaff = await prisma_1.default.user.findMany({
            where: {
                companyId: companyId,
                role: { in: ['ADMIN', 'FARM_KEEPER'] },
                // id: { not: companyId }
                id: { not: companyAdmin.id }
            },
            select: {
                id: true,
                fullName: true,
                role: true,
                email: true,
                location: true,
                avatar: true,
                lastLogin: true
            },
            orderBy: { role: 'asc' }
        });
        // Get livestock statistics
        const livestockStats = await prisma_1.default.livestock.aggregate({
            where: {
                addedBy: {
                    // companyName: companyAdmin.companyName
                    companyId: companyId
                },
                isDeleted: false
            },
            _count: {
                _all: true
            },
            _avg: {
                weight: true
            }
        });
        // Get livestock by health status
        const livestockByHealth = await prisma_1.default.livestock.groupBy({
            by: ['healthStatus'],
            where: {
                addedBy: {
                    // companyName: companyAdmin.companyName
                    companyId: companyId
                },
                isDeleted: false
            },
            _count: {
                _all: true
            }
        });
        // Get offtake statistics
        const offtakeStats = await prisma_1.default.offtakeRecord.groupBy({
            by: ['type'],
            where: {
                livestock: {
                    addedBy: {
                        // companyName: companyAdmin.companyName
                        companyId: companyId
                    }
                }
            },
            _count: {
                _all: true
            }
        });
        // Get recent deaths (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentDeaths = await prisma_1.default.offtakeRecord.findMany({
            where: {
                livestock: {
                    addedBy: {
                        // companyName: companyAdmin.companyName
                        companyId: companyId
                    }
                },
                type: 'DEATH',
                dateOfEvent: {
                    gte: thirtyDaysAgo
                }
            },
            include: {
                livestock: {
                    select: {
                        id: true,
                        tagId: true,
                        type: true,
                        breed: true
                    }
                },
                recordedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true
                    }
                }
            },
            orderBy: { dateOfEvent: 'desc' },
            take: 10
        });
        // Get death causes breakdown
        const deathCauses = await prisma_1.default.offtakeRecord.groupBy({
            by: ['causeOfDeath'],
            where: {
                livestock: {
                    addedBy: {
                        // companyName: companyAdmin.companyName
                        companyId: companyId
                    }
                },
                type: 'DEATH',
                causeOfDeath: { not: null }
            },
            _count: {
                _all: true
            }
        });
        // Get sickness statistics
        const sicknessStats = await prisma_1.default.sickness.aggregate({
            where: {
                livestock: {
                    addedBy: {
                        // companyName: companyAdmin.companyName
                        companyId: companyId
                    }
                }
            },
            _count: {
                _all: true
            }
        });
        // Get treatment statistics
        const treatmentStats = await prisma_1.default.treatment.aggregate({
            where: {
                livestock: {
                    addedBy: {
                        // companyName: companyAdmin.companyName
                        companyId: companyId
                    }
                }
            },
            _count: {
                _all: true
            }
        });
        // Get vaccination statistics
        const vaccinationStats = await prisma_1.default.vaccination.aggregate({
            where: {
                livestock: {
                    addedBy: {
                        // companyName: companyAdmin.companyName
                        companyId: companyId
                    }
                }
            },
            _count: {
                _all: true
            }
        });
        // Get overdue vaccinations (missed due dates)
        const overdueVaccinations = await prisma_1.default.vaccination.count({
            where: {
                livestock: {
                    addedBy: {
                        // companyName: companyAdmin.companyName
                        companyId: companyId
                    }
                },
                nextDueDate: {
                    lt: new Date()
                }
            }
        });
        // Get recent sickness cases
        const recentSickness = await prisma_1.default.sickness.findMany({
            where: {
                livestock: {
                    addedBy: {
                        // companyName: companyAdmin.companyName
                        companyId: companyId
                    }
                }
            },
            include: {
                livestock: {
                    select: {
                        id: true,
                        tagId: true,
                        type: true,
                        breed: true
                    }
                },
                recordedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true
                    }
                },
                treatments: {
                    orderBy: { dateOfTreatment: 'desc' },
                    take: 1,
                    include: {
                        recordedBy: {
                            select: {
                                id: true,
                                fullName: true,
                                role: true
                            }
                        }
                    }
                }
            },
            orderBy: { dateOfObservation: 'desc' },
            take: 10
        });
        // Get upcoming vaccinations
        const upcomingVaccinations = await prisma_1.default.vaccination.findMany({
            where: {
                livestock: {
                    addedBy: {
                        // companyName: companyAdmin.companyName
                        companyId: companyId
                    }
                },
                nextDueDate: {
                    gte: new Date()
                }
            },
            include: {
                livestock: {
                    select: {
                        id: true,
                        tagId: true,
                        type: true
                    }
                },
                recordedBy: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true
                    }
                }
            },
            orderBy: { nextDueDate: 'asc' },
            take: 10
        });
        // Get active tasks
        const activeTasks = await prisma_1.default.task.findMany({
            where: {
                assignedToId: userId,
                assignedById: companyId,
                status: { in: ['PENDING', 'IN_PROGRESS'] }
            },
            include: {
                livestock: {
                    select: {
                        id: true,
                        tagId: true,
                        type: true,
                        healthStatus: true
                    }
                }
            },
            orderBy: { dueDate: 'asc' },
            take: 10
        });
        // CALCULATE FARM HEALTH INDEX
        const calculateFarmHealthIndex = () => {
            const totalLivestock = livestockStats._count._all;
            if (totalLivestock === 0)
                return 0;
            const totalLivestockEver = totalLivestock + offtakeStats.reduce((sum, item) => sum + item._count._all, 0);
            const totalDeaths = offtakeStats.find(item => item.type === 'DEATH')?._count._all || 0;
            // Component 1: Livestock Health Status (40% weight)
            const healthyLivestock = livestockByHealth.find(item => item.healthStatus === 'HEALTHY')?._count._all || 0;
            const sickLivestock = livestockByHealth.find(item => ['SICK', 'IN_TREATMENT', 'CRITICAL'].includes(item.healthStatus))?._count._all || 0;
            const healthStatusScore = totalLivestock > 0 ? (healthyLivestock / totalLivestock) * 100 : 0;
            // Component 2: Mortality Rate (25% weight)
            const mortalityRate = totalLivestockEver > 0 ? (totalDeaths / totalLivestockEver) * 100 : 0;
            const mortalityScore = Math.max(0, 100 - (mortalityRate * 2)); // Penalize high mortality
            // Component 3: Treatment Effectiveness (20% weight)
            const treatmentRate = sicknessStats._count._all > 0
                ? (treatmentStats._count._all / sicknessStats._count._all) * 100
                : 100; // No sickness = perfect score
            const treatmentScore = Math.min(100, treatmentRate);
            // Component 4: Vaccination Compliance (15% weight)
            const totalVaccinationsDue = vaccinationStats._count._all;
            const vaccinationComplianceRate = totalVaccinationsDue > 0
                ? Math.max(0, 100 - ((overdueVaccinations / totalVaccinationsDue) * 100))
                : 100; // No vaccinations due = perfect score
            const vaccinationScore = vaccinationComplianceRate;
            // Calculate weighted score
            const healthIndex = ((healthStatusScore * 0.40) +
                (mortalityScore * 0.25) +
                (treatmentScore * 0.20) +
                (vaccinationScore * 0.15));
            return Math.round(Math.max(0, Math.min(100, healthIndex)));
        };
        const farmHealthIndex = calculateFarmHealthIndex();
        // Determine health status
        const getHealthStatus = (index) => {
            if (index >= 90)
                return 'EXCELLENT';
            if (index >= 75)
                return 'GOOD';
            if (index >= 60)
                return 'FAIR';
            if (index >= 40)
                return 'POOR';
            return 'CRITICAL';
        };
        // Calculate individual metrics for detailed breakdown
        const totalLivestockEver = livestockStats._count._all + offtakeStats.reduce((sum, item) => sum + item._count._all, 0);
        const totalDeaths = offtakeStats.find(item => item.type === 'DEATH')?._count._all || 0;
        const healthyLivestock = livestockByHealth.find(item => item.healthStatus === 'HEALTHY')?._count._all || 0;
        const mortalityRate = totalLivestockEver > 0 ? (totalDeaths / totalLivestockEver) * 100 : 0;
        const treatmentRate = sicknessStats._count._all > 0
            ? (treatmentStats._count._all / sicknessStats._count._all) * 100
            : 100;
        // Format the statistics properly
        const farmDetails = {
            company: companyAdmin,
            staff: farmStaff,
            healthIndex: {
                overall: farmHealthIndex,
                status: getHealthStatus(farmHealthIndex),
                breakdown: {
                    livestockHealth: Math.round((healthyLivestock / livestockStats._count._all) * 100) || 0,
                    mortalityRate: Math.round(mortalityRate * 100) / 100,
                    treatmentEffectiveness: Math.round(treatmentRate),
                    vaccinationCompliance: Math.max(0, 100 - ((overdueVaccinations / vaccinationStats._count._all) * 100)) || 100
                },
                components: [
                    { name: 'Livestock Health', score: Math.round((healthyLivestock / livestockStats._count._all) * 100) || 0, weight: 40 },
                    { name: 'Mortality Rate', score: Math.max(0, 100 - (mortalityRate * 2)), weight: 25 },
                    { name: 'Treatment Effectiveness', score: Math.round(treatmentRate), weight: 20 },
                    { name: 'Vaccination Compliance', score: Math.max(0, 100 - ((overdueVaccinations / vaccinationStats._count._all) * 100)) || 100, weight: 15 }
                ]
            },
            statistics: {
                livestock: {
                    total: livestockStats._count._all,
                    averageWeight: livestockStats._avg.weight,
                    healthBreakdown: livestockByHealth.map(item => ({
                        healthStatus: item.healthStatus,
                        count: item._count._all,
                        percentage: Math.round((item._count._all / livestockStats._count._all) * 100)
                    }))
                },
                offtake: {
                    totalDeaths,
                    totalSales: offtakeStats.find(item => item.type === 'SALE')?._count._all || 0,
                    totalMissing: offtakeStats.find(item => item.type === 'MISSING')?._count._all || 0,
                    mortalityRate: Math.round(mortalityRate * 100) / 100,
                    deathCauses: deathCauses.map(item => ({
                        cause: item.causeOfDeath || 'Unknown',
                        count: item._count._all
                    })).filter(item => item.cause !== 'Unknown')
                },
                medical: {
                    totalSicknessCases: sicknessStats._count._all,
                    totalTreatments: treatmentStats._count._all,
                    totalVaccinations: vaccinationStats._count._all,
                    overdueVaccinations,
                    treatmentSuccessRate: Math.round(treatmentRate)
                }
            },
            recentDeaths,
            recentSickness,
            upcomingVaccinations,
            activeTasks
        };
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Farm details retrieved successfully', farmDetails);
    }
    catch (error) {
        next(error);
    }
};
exports.getFarmDetails = getFarmDetails;
const getAllVets = async (req, res, next) => {
    try {
        // console.log('🟢 getAllVets function STARTED');
        const currentUser = req.user;
        const role = currentUser.role;
        console.log('👨‍⚕️ Fetching all vets requested by:', {
            userId: currentUser.id,
            userRole: role,
            companyId: currentUser.companyId
        });
        if (role !== 'ADMIN') {
            throw new ForbiddenError_1.ForbiddenError('Only admins can view all registered vets');
        }
        // Get query parameters for filtering, pagination, etc.
        const { page = 1, limit = 20, search = '', sortBy = 'createdAt', sortOrder = 'desc', verified, location } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // Build the where clause
        const whereClause = {
            role: 'VET',
        };
        // Add search filter
        if (search) {
            whereClause.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { location: { contains: search, mode: 'insensitive' } }
            ];
        }
        if (verified !== undefined) {
            whereClause.isVerified = verified === 'true';
        }
        if (location) {
            whereClause.location = { contains: location, mode: 'insensitive' };
        }
        const [vets, totalVets, activeVetsCount] = await Promise.all([
            prisma_1.default.user.findMany({
                where: whereClause,
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phone: true,
                    avatar: true,
                    location: true,
                    isVerified: true,
                    isSuspended: true,
                    lastLogin: true,
                    createdAt: true,
                    updatedAt: true,
                    bio: true,
                    specializations: true,
                    totalRatings: true,
                    consultationFee: true,
                    _count: {
                        select: {
                            assignedTasks: {
                                where: {
                                    status: { in: ['PENDING', 'IN_PROGRESS'] }
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    [sortBy]: sortOrder
                },
                skip: skip,
                take: limitNum
            }),
            prisma_1.default.user.count({
                where: whereClause
            }),
            prisma_1.default.user.count({
                where: {
                    role: 'VET',
                    lastLogin: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    }
                }
            })
        ]);
        // Get statistics about vets' performance/activity
        const vetStatistics = await (0, vet_helpers_1.getVetStatistics)();
        // Format the response
        const responseData = {
            vets: vets.map(vet => ({
                ...vet,
                activeTasks: vet._count?.assignedTasks || 0
            })),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalVets,
                pages: Math.ceil(totalVets / limitNum)
            },
            statistics: {
                totalVets,
                activeVets: activeVetsCount,
                verifiedVets: await prisma_1.default.user.count({
                    where: { role: 'VET', isVerified: true }
                }),
                suspendedVets: await prisma_1.default.user.count({
                    where: { role: 'VET', isSuspended: true }
                }),
                ...vetStatistics
            }
        };
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, 'Vets retrieved successfully', responseData);
    }
    catch (error) {
        next(error);
    }
};
exports.getAllVets = getAllVets;
// export const getAllVets = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const currentUser = (req.user as any);
//     console.log('👨‍⚕️ Fetching all vets requested by:', {
//       userId: currentUser.id,
//       userRole: currentUser.role
//     });
//     const vets = await prisma.user.findMany({
//       where: {
//         role: 'VET',
//       },
//       select: {
//         id: true,
//         fullName: true,
//         email: true,
//         phone: true,
//         avatar: true,
//         location: true,
//         isVerified: true,
//         lastLogin: true,
//         createdAt: true
//       },
//       orderBy: {
//         createdAt: 'desc'
//       }
//     });
//     sendSuccessResponse(res, 'Vets retrieved successfully', {
//       vets,
//       total: vets.length
//     });
//   } catch (error) {
//     next(error);
//   }
// };
