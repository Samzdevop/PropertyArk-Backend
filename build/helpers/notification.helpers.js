"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LivestockNotificationHelpers = exports.NotificationHelpers = void 0;
const notification_services_1 = require("../services/notification.services");
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
class NotificationHelpers {
    static async createTaskAssignmentNotification(task, assignedTo) {
        try {
            const shouldNotify = await notification_services_1.NotificationService.shouldSendNotification(assignedTo.id, 'MESSAGE');
            if (!shouldNotify) {
                console.log(`Skipping task assignment notification for user ${assignedTo.id} - message notifications disabled`);
                return;
            }
            await notification_services_1.NotificationService.createNotification({
                title: 'New Task Assigned',
                message: `You have been assigned a new task: ${task.name}`,
                type: client_1.NotificationType.TASK_ASSIGNED,
                status: client_1.NotificationStatus.UNREAD,
                recipientId: assignedTo.id,
                relatedEntityType: 'TASK',
                relatedEntityId: task.id,
                metadata: {
                    taskId: task.id,
                    taskName: task.name,
                    priority: task.priority,
                    dueDate: task.dueDate,
                    assignedByName: task.assignedBy.fullName
                }
            });
            // console.log(`✅ Created task assignment notification for ${assignedTo.fullName}`);
        }
        catch (error) {
            console.error('❌ Error creating task assignment notification:', error);
        }
    }
    static async createAnnouncementNotification(announcement, farmName) {
        try {
            const farmMembers = await prisma_1.default.user.findMany({
                where: {
                    companyName: farmName
                }
            });
            let notifiedCount = 0;
            let skippedCount = 0;
            for (const member of farmMembers) {
                // Check if user wants message notifications
                const shouldNotify = await notification_services_1.NotificationService.shouldSendNotification(member.id, 'MESSAGE');
                if (!shouldNotify) {
                    skippedCount++;
                    continue;
                }
                await notification_services_1.NotificationService.createNotification({
                    title: 'New Announcement',
                    message: announcement.title,
                    type: client_1.NotificationType.ANNOUNCEMENT,
                    status: client_1.NotificationStatus.UNREAD,
                    recipientId: member.id,
                    relatedEntityType: 'ANNOUNCEMENT',
                    relatedEntityId: announcement.id,
                    metadata: {
                        announcementId: announcement.id,
                        title: announcement.title,
                        content: announcement.content
                    }
                });
                notifiedCount++;
            }
            // console.log(`Created announcement notifications for ${farmMembers.length} farm members`);
        }
        catch (error) {
            console.error('Error creating announcement notifications:', error);
        }
    }
}
exports.NotificationHelpers = NotificationHelpers;
class LivestockNotificationHelpers {
    static async createLivestockUpdateRequest(livestockId, requestType, requestedBy, additionalNotes = '') {
        try {
            // Verify livestock exists and get its details
            const livestock = await prisma_1.default.livestock.findUnique({
                where: {
                    id: livestockId,
                    isDeleted: false
                },
                select: {
                    id: true,
                    tagId: true,
                    type: true,
                    breed: true,
                    gender: true,
                    weight: true,
                    healthStatus: true,
                    companyId: true
                }
            });
            if (!livestock || !livestock.companyId) {
                throw new Error('Livestock not found or not associated with a company');
            }
            // Get company and farmkeepers
            const company = await prisma_1.default.company.findUnique({
                where: {
                    id: livestock.companyId
                },
                include: {
                    users: {
                        where: {
                            role: 'FARM_KEEPER',
                            isSuspended: false,
                            isVerified: true
                        },
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phone: true
                        }
                    }
                }
            });
            if (!company) {
                throw new Error('Company not found');
            }
            const farmKeepers = company.users || [];
            if (farmKeepers.length === 0) {
                throw new Error('No farmkeeper found for this company');
            }
            let title = '';
            let message = '';
            switch (requestType) {
                case 'WEIGHT_UPDATE':
                    title = 'Weight Update Requested';
                    message = `Please update the weight for livestock ${livestock.tagId} (${livestock.type})`;
                    break;
                case 'HEALTH_STATUS_UPDATE':
                    title = 'Health Status Update Requested';
                    message = `Please update the health status for livestock ${livestock.tagId} (${livestock.type})`;
                    break;
                case 'COMBINED_UPDATE':
                    title = 'Weight and Health Status Update Requested';
                    message = `Please update both weight and health status for livestock ${livestock.tagId} (${livestock.type})`;
                    break;
            }
            const notifications = [];
            let skippedCount = 0;
            for (const farmKeeper of farmKeepers) {
                // Check if farmkeeper wants message notifications
                const shouldNotify = await notification_services_1.NotificationService.shouldSendNotification(farmKeeper.id, 'MESSAGE');
                if (!shouldNotify) {
                    skippedCount++;
                    continue;
                }
                const notification = await notification_services_1.NotificationService.createNotification({
                    title,
                    message,
                    type: client_1.NotificationType.TASK_ASSIGNED,
                    status: client_1.NotificationStatus.UNREAD,
                    recipientId: farmKeeper.id,
                    relatedEntityType: 'LIVESTOCK',
                    relatedEntityId: livestock.id,
                    metadata: {
                        livestockId: livestock.id,
                        tagId: livestock.tagId,
                        type: livestock.type,
                        breed: livestock.breed || 'Not specified',
                        gender: livestock.gender,
                        currentWeight: livestock.weight,
                        currentHealthStatus: livestock.healthStatus,
                        requestedBy: requestedBy.fullName,
                        requestedByRole: requestedBy.role,
                        requestedById: requestedBy.id,
                        companyId: livestock.companyId,
                        companyName: company.name,
                        additionalNotes,
                        requestType,
                        timestamp: new Date().toISOString()
                    }
                });
                if (notification) {
                    notifications.push(notification);
                }
            }
            return {
                livestock,
                company,
                farmKeepers,
                notifications,
                skippedCount
            };
        }
        catch (error) {
            console.error(`Error creating livestock update request:`, error);
            throw error;
        }
    }
}
exports.LivestockNotificationHelpers = LivestockNotificationHelpers;
