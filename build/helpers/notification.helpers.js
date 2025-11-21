"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationHelpers = void 0;
// src/helpers/notification.helpers.ts
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
class NotificationHelpers {
    /**
     * Create task assignment notification
     */
    static async createTaskAssignmentNotification(task, assignedTo) {
        try {
            await prisma_1.default.notification.create({
                data: {
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
                }
            });
            console.log(`✅ Created task assignment notification for ${assignedTo.fullName}`);
        }
        catch (error) {
            console.error('❌ Error creating task assignment notification:', error);
        }
    }
    /**
     * Create announcement notification for all farm members
     */
    static async createAnnouncementNotification(announcement, farmName) {
        try {
            const farmMembers = await prisma_1.default.user.findMany({
                where: {
                    companyName: farmName
                }
            });
            const notifications = farmMembers.map(member => ({
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
            }));
            await prisma_1.default.notification.createMany({
                data: notifications
            });
            console.log(`✅ Created announcement notifications for ${farmMembers.length} farm members`);
        }
        catch (error) {
            console.error('❌ Error creating announcement notifications:', error);
        }
    }
}
exports.NotificationHelpers = NotificationHelpers;
// import prisma from '../prisma';
// export class NotificationHelpers {
//   /**
//    * Create task assignment notification
//    */
//   static async createTaskAssignmentNotification(task: any, assignedTo: any) {
//     try {
//       await prisma.notification.create({
//         data: {
//           title: 'New Task Assigned',
//           message: `You have been assigned a new task: ${task.name}`,
//           type: 'TASK_ASSIGNED',
//           recipientId: assignedTo.id,
//           relatedEntityType: 'TASK',
//           relatedEntityId: task.id,
//           metadata: {
//             taskId: task.id,
//             taskName: task.name,
//             priority: task.priority,
//             dueDate: task.dueDate,
//             assignedByName: task.assignedBy.fullName
//           }
//         }
//       });
//       console.log(`✅ Created task assignment notification for ${assignedTo.fullName}`);
//     } catch (error) {
//       console.error('❌ Error creating task assignment notification:', error);
//     }
//   }
//   /**
//    * Create announcement notification for all farm members
//    */
//   static async createAnnouncementNotification(announcement: any, farmName: string) {
//     try {
//       const farmMembers = await prisma.user.findMany({
//         where: {
//           companyName: farmName
//         }
//       });
//       const notifications = farmMembers.map(member => ({
//         title: 'New Announcement',
//         message: announcement.title,
//         type: 'ANNOUNCEMENT',
//         recipientId: member.id,
//         relatedEntityType: 'ANNOUNCEMENT',
//         relatedEntityId: announcement.id,
//         metadata: {
//           announcementId: announcement.id,
//           title: announcement.title,
//           content: announcement.content
//         }
//       }));
//       await prisma.notification.createMany({
//         data: notifications
//       });
//       console.log(`Created announcement notifications for ${farmMembers.length} farm members`);
//     } catch (error) {
//       console.error('Error creating announcement notifications:', error);
//     }
//   }
// }
