"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const notification_services_1 = require("./notification.services");
class ReminderService {
    /**
     * Check and process all due reminders
     */
    static async checkDueReminders() {
        try {
            const now = new Date();
            console.log(`Checking due reminders at ${now.toISOString()}`);
            // Check appointment reminders
            const dueAppointmentReminders = await prisma_1.default.appointmentReminder.findMany({
                where: {
                    dueDate: { lte: now },
                    isSent: false
                },
                include: {
                    appointment: {
                        include: {
                            recordedBy: true,
                            company: true
                        }
                    }
                }
            });
            for (const reminder of dueAppointmentReminders) {
                // Check if user wants appointment notifications
                const shouldNotify = await notification_services_1.NotificationService.shouldSendNotification(reminder.appointment.recordedById, 'APPOINTMENT_REMINDER');
                if (shouldNotify) {
                    await this.sendAppointmentReminder(reminder);
                }
                await prisma_1.default.appointmentReminder.update({
                    where: { id: reminder.id },
                    data: { isSent: true, sentAt: new Date() }
                });
            }
            // Check treatment reminders
            const dueTreatmentReminders = await prisma_1.default.treatmentReminder.findMany({
                where: {
                    dueDate: { lte: now },
                    isSent: false
                },
                include: {
                    prescribedTreatment: {
                        include: {
                            livestock: {
                                select: {
                                    id: true,
                                    tagId: true,
                                    type: true,
                                    addedBy: {
                                        select: {
                                            id: true,
                                            companyName: true
                                        }
                                    }
                                }
                            },
                            recordedBy: {
                                select: {
                                    id: true,
                                    fullName: true
                                }
                            }
                        }
                    }
                }
            });
            // Check follow-up reminders
            const dueFollowUpReminders = await prisma_1.default.followUpReminder.findMany({
                where: {
                    dueDate: { lte: now },
                    isSent: false
                },
                include: {
                    followUp: {
                        include: {
                            relatedAnimal: {
                                select: {
                                    id: true,
                                    tagId: true,
                                    type: true
                                }
                            },
                            recordedBy: {
                                select: {
                                    id: true,
                                    fullName: true
                                }
                            },
                            prescribedTreatment: {
                                select: {
                                    id: true,
                                    medicationName: true
                                }
                            }
                        }
                    }
                }
            });
            // Process reminders
            await this.processTreatmentReminders(dueTreatmentReminders);
            await this.processFollowUpReminders(dueFollowUpReminders);
            console.log(`Processed ${dueAppointmentReminders.length} appointment reminders, ${dueTreatmentReminders.length} treatment reminders and ${dueFollowUpReminders.length} follow-up reminders`);
        }
        catch (error) {
            console.error('Error checking due reminders:', error);
        }
    }
    /**
     * Send appointment reminder
     */
    static async sendAppointmentReminder(reminder) {
        try {
            const { appointment } = reminder;
            // Check if user wants appointment notifications
            const shouldNotify = await notification_services_1.NotificationService.shouldSendNotification(appointment.recordedById, 'APPOINTMENT_REMINDER');
            if (!shouldNotify) {
                console.log(`Skipping appointment reminder for user ${appointment.recordedById} - notifications disabled`);
                return;
            }
            // Create notification for the appointment creator
            await notification_services_1.NotificationService.createNotification({
                title: 'Appointment Reminder',
                message: `Reminder: ${appointment.title} on ${appointment.date.toLocaleDateString()} at ${appointment.date.toLocaleTimeString()}`,
                type: client_1.NotificationType.APPOINTMENT_REMINDER,
                status: client_1.NotificationStatus.UNREAD,
                recipientId: appointment.recordedById,
                relatedEntityType: 'APPOINTMENT',
                relatedEntityId: appointment.id,
                metadata: {
                    appointmentId: appointment.id,
                    title: appointment.title,
                    date: appointment.date,
                    purpose: appointment.purpose,
                    visitType: appointment.visitType,
                    relatedFarm: appointment.relatedFarm
                }
            });
            // Notify farm staff if enabled
            if (appointment.notifyFarmStaff) {
                await this.notifyFarmStaffAboutAppointment(appointment);
            }
            console.log(`Sent appointment reminder for ${appointment.title}`);
        }
        catch (error) {
            console.error(`Error sending appointment reminder ${reminder.id}:`, error);
        }
    }
    /**
     * Process due treatment reminders
     */
    static async processTreatmentReminders(reminders) {
        for (const reminder of reminders) {
            try {
                const { prescribedTreatment } = reminder;
                // Check if user wants treatment reminders
                const shouldNotify = await notification_services_1.NotificationService.shouldSendNotification(prescribedTreatment.recordedById, 'TREATMENT_REMINDER');
                if (!shouldNotify) {
                    console.log(`Skipping treatment reminder for user ${prescribedTreatment.recordedById} - notifications disabled`);
                    continue;
                }
                // Create notification for the vet who prescribed the treatment
                await notification_services_1.NotificationService.createNotification({
                    title: 'Treatment Reminder',
                    message: `Time to administer ${prescribedTreatment.medicationName} to ${prescribedTreatment.livestock.tagId}`,
                    type: client_1.NotificationType.TREATMENT_REMINDER,
                    status: client_1.NotificationStatus.UNREAD,
                    recipientId: prescribedTreatment.recordedById,
                    relatedEntityType: 'PRESCRIBED_TREATMENT',
                    relatedEntityId: prescribedTreatment.id,
                    metadata: {
                        treatmentId: prescribedTreatment.id,
                        livestockTag: prescribedTreatment.livestock.tagId,
                        medication: prescribedTreatment.medicationName,
                        dosage: prescribedTreatment.dosage,
                        frequency: prescribedTreatment.frequency
                    }
                });
                // Also notify farm staff if it's an active treatment
                if (prescribedTreatment.isActive) {
                    await this.notifyFarmStaffAboutTreatment(prescribedTreatment);
                }
                // Mark reminder as sent
                await prisma_1.default.treatmentReminder.update({
                    where: { id: reminder.id },
                    data: {
                        isSent: true,
                        sentAt: new Date()
                    }
                });
                console.log(`Sent treatment reminder for ${prescribedTreatment.medicationName}`);
            }
            catch (error) {
                console.error(`Error processing treatment reminder ${reminder.id}:`, error);
            }
        }
    }
    /**
     * Process due follow-up reminders
     */
    static async processFollowUpReminders(reminders) {
        for (const reminder of reminders) {
            try {
                const { followUp } = reminder;
                // Check if user wants follow-up reminders
                const shouldNotify = await notification_services_1.NotificationService.shouldSendNotification(followUp.recordedById, 'FOLLOW_UP_REMINDER');
                if (!shouldNotify) {
                    console.log(`Skipping follow-up reminder for user ${followUp.recordedById} - notifications disabled`);
                    continue;
                }
                // Notify the vet who scheduled the follow-up
                await notification_services_1.NotificationService.createNotification({
                    title: 'Follow-up Reminder',
                    message: `Follow-up reminder: ${followUp.reason} for ${followUp.relatedAnimal.tagId}`,
                    type: client_1.NotificationType.FOLLOW_UP_REMINDER,
                    status: client_1.NotificationStatus.UNREAD,
                    recipientId: followUp.recordedById,
                    relatedEntityType: 'FOLLOW_UP',
                    relatedEntityId: followUp.id,
                    metadata: {
                        followUpId: followUp.id,
                        animalTag: followUp.relatedAnimal.tagId,
                        reason: followUp.reason,
                        date: followUp.date,
                        location: followUp.location
                    }
                });
                // Notify farm staff if enabled
                if (followUp.notifyFarmStaff) {
                    await this.notifyFarmStaffAboutFollowUp(followUp);
                }
                // Mark reminder as sent
                await prisma_1.default.followUpReminder.update({
                    where: { id: reminder.id },
                    data: {
                        isSent: true,
                        sentAt: new Date()
                    }
                });
                console.log(`Sent follow-up reminder for ${followUp.relatedAnimal.tagId}`);
            }
            catch (error) {
                console.error(`Error processing follow-up reminder ${reminder.id}:`, error);
            }
        }
    }
    /**
     * Notify farm staff about appointment reminders
     */
    static async notifyFarmStaffAboutAppointment(appointment) {
        try {
            const farmStaff = await prisma_1.default.user.findMany({
                where: {
                    companyName: appointment.relatedFarm,
                    role: { in: ['ADMIN', 'FARM_KEEPER', 'COWORKER'] }
                }
            });
            let notifiedCount = 0;
            let skippedCount = 0;
            for (const staff of farmStaff) {
                // Check if user wants appointment notifications
                const shouldNotify = await notification_services_1.NotificationService.shouldSendNotification(staff.id, 'APPOINTMENT_REMINDER');
                if (!shouldNotify) {
                    skippedCount++;
                    continue;
                }
                await notification_services_1.NotificationService.createNotification({
                    title: 'Appointment Reminder',
                    message: `Reminder: ${appointment.title} with Dr. ${appointment.recordedBy.fullName} on ${appointment.date.toLocaleDateString()}`,
                    type: client_1.NotificationType.APPOINTMENT_REMINDER,
                    status: client_1.NotificationStatus.UNREAD,
                    recipientId: staff.id,
                    relatedEntityType: 'APPOINTMENT',
                    relatedEntityId: appointment.id,
                    metadata: {
                        appointmentId: appointment.id,
                        title: appointment.title,
                        date: appointment.date,
                        purpose: appointment.purpose,
                        vetName: appointment.recordedBy.fullName
                    }
                });
                notifiedCount++;
            }
            console.log(`Notified ${notifiedCount} farm staff about appointment (${skippedCount} skipped due to disabled notifications)`);
        }
        catch (error) {
            console.error('Error notifying farm staff about appointment:', error);
        }
    }
    /**
     * Notify farm staff about treatment reminders
     */
    static async notifyFarmStaffAboutTreatment(prescribedTreatment) {
        try {
            const farmStaff = await prisma_1.default.user.findMany({
                where: {
                    companyName: prescribedTreatment.livestock.addedBy.companyName,
                    role: { in: ['ADMIN', 'FARM_KEEPER'] }
                }
            });
            let notifiedCount = 0;
            let skippedCount = 0;
            for (const staff of farmStaff) {
                // Check if user wants treatment reminders
                const shouldNotify = await notification_services_1.NotificationService.shouldSendNotification(staff.id, 'TREATMENT_REMINDER');
                if (!shouldNotify) {
                    skippedCount++;
                    continue;
                }
                await notification_services_1.NotificationService.createNotification({
                    title: 'Treatment Administration Due',
                    message: `Time to administer ${prescribedTreatment.medicationName} to ${prescribedTreatment.livestock.tagId}`,
                    type: client_1.NotificationType.TREATMENT_REMINDER,
                    status: client_1.NotificationStatus.UNREAD,
                    recipientId: staff.id,
                    relatedEntityType: 'PRESCRIBED_TREATMENT',
                    relatedEntityId: prescribedTreatment.id,
                    metadata: {
                        treatmentId: prescribedTreatment.id,
                        livestockTag: prescribedTreatment.livestock.tagId,
                        medication: prescribedTreatment.medicationName,
                        dosage: prescribedTreatment.dosage
                    }
                });
                notifiedCount++;
            }
            console.log(`Notified ${notifiedCount} farm staff about treatment (${skippedCount} skipped due to disabled notifications)`);
        }
        catch (error) {
            console.error('Error notifying farm staff about treatment:', error);
        }
    }
    /**
     * Notify farm staff about follow-up
     */
    static async notifyFarmStaffAboutFollowUp(followUp) {
        try {
            const farmStaff = await prisma_1.default.user.findMany({
                where: {
                    companyName: followUp.relatedFarm,
                    role: { in: ['ADMIN', 'FARM_KEEPER'] }
                }
            });
            let notifiedCount = 0;
            let skippedCount = 0;
            for (const staff of farmStaff) {
                // Check if user wants follow-up reminders
                const shouldNotify = await notification_services_1.NotificationService.shouldSendNotification(staff.id, 'FOLLOW_UP_REMINDER');
                if (!shouldNotify) {
                    skippedCount++;
                    continue;
                }
                await notification_services_1.NotificationService.createNotification({
                    title: 'Follow-up Scheduled',
                    message: `Veterinary follow-up scheduled for ${followUp.relatedAnimal.tagId} on ${followUp.date.toLocaleDateString()}`,
                    type: client_1.NotificationType.FOLLOW_UP_REMINDER,
                    status: client_1.NotificationStatus.UNREAD,
                    recipientId: staff.id,
                    relatedEntityType: 'FOLLOW_UP',
                    relatedEntityId: followUp.id,
                    metadata: {
                        followUpId: followUp.id,
                        animalTag: followUp.relatedAnimal.tagId,
                        date: followUp.date,
                        reason: followUp.reason,
                        location: followUp.location
                    }
                });
                notifiedCount++;
            }
            console.log(`Notified ${notifiedCount} farm staff about follow-up (${skippedCount} skipped due to disabled notifications)`);
        }
        catch (error) {
            console.error('Error notifying farm staff about follow-up:', error);
        }
    }
    /**
     * Clean up old sent reminders (older than 30 days)
     */
    static async cleanupOldReminders() {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const [appointmentReminders, treatmentReminders, followUpReminders] = await Promise.all([
                prisma_1.default.appointmentReminder.deleteMany({
                    where: {
                        isSent: true,
                        sentAt: { lt: thirtyDaysAgo }
                    }
                }),
                prisma_1.default.treatmentReminder.deleteMany({
                    where: {
                        isSent: true,
                        sentAt: { lt: thirtyDaysAgo }
                    }
                }),
                prisma_1.default.followUpReminder.deleteMany({
                    where: {
                        isSent: true,
                        sentAt: { lt: thirtyDaysAgo }
                    }
                })
            ]);
            console.log(`Cleaned up ${appointmentReminders.count} appointment reminders, ${treatmentReminders.count} treatment reminders, and ${followUpReminders.count} follow-up reminders`);
        }
        catch (error) {
            console.error('Error cleaning up old reminders:', error);
        }
    }
}
exports.ReminderService = ReminderService;
// // src/services/reminder.service.ts
// import prisma from '../prisma';
// import { NotificationType, NotificationStatus } from '@prisma/client';
// import { NotificationService } from './notification.services';
// export class ReminderService {
//   /**
//    * Check and process all due reminders
//    */
//   static async checkDueReminders() {
//     try {
//       const now = new Date();
//       console.log(`Checking due reminders at ${now.toISOString()}`);
//       const dueAppointmentReminders = await prisma.appointmentReminder.findMany({
//         where: {
//           dueDate: { lte: now },
//           isSent: false
//         },
//         include: {
//           appointment: {
//             include: {
//               recordedBy: true,
//               company: true
//             }
//           }
//         }
//       });
//       for (const reminder of dueAppointmentReminders) {
//         // Check if user wants appointment notifications
//         const shouldNotify = await NotificationService.shouldSendNotification(
//           reminder.appointment.recordedById,
//           'APPOINTMENT_REMINDER'
//         );
//         if (shouldNotify) {
//           await this.sendAppointmentReminder(reminder);
//         }
//         await prisma.appointmentReminder.update({
//           where: { id: reminder.id },
//           data: { isSent: true, sentAt: new Date() }
//         });
//       }
//       // Check treatment reminders
//       const dueTreatmentReminders = await prisma.treatmentReminder.findMany({
//         where: {
//           dueDate: { lte: now },
//           isSent: false
//         },
//         include: {
//           prescribedTreatment: {
//             include: {
//               livestock: {
//                 select: {
//                   id: true,
//                   tagId: true,
//                   type: true,
//                   addedBy: {
//                     select: {
//                       id: true,
//                       companyName: true
//                     }
//                   }
//                 }
//               },
//               recordedBy: {
//                 select: {
//                   id: true,
//                   fullName: true
//                 }
//               }
//             }
//           }
//         }
//       });
//       // Check follow-up reminders
//       const dueFollowUpReminders = await prisma.followUpReminder.findMany({
//         where: {
//           dueDate: { lte: now },
//           isSent: false
//         },
//         include: {
//           followUp: {
//             include: {
//               relatedAnimal: {
//                 select: {
//                   id: true,
//                   tagId: true,
//                   type: true
//                 }
//               },
//               recordedBy: {
//                 select: {
//                   id: true,
//                   fullName: true
//                 }
//               },
//               prescribedTreatment: {
//                 select: {
//                   id: true,
//                   medicationName: true
//                 }
//               }
//             }
//           }
//         }
//       });
//       // Process reminders
//       await this.processTreatmentReminders(dueTreatmentReminders);
//       await this.processFollowUpReminders(dueFollowUpReminders);
//       console.log(`Processed ${dueTreatmentReminders.length} treatment reminders and ${dueFollowUpReminders.length} follow-up reminders`);
//     } catch (error) {
//       console.error('Error checking due reminders:', error);
//     }
//   }
//   /**
//    * Process due treatment reminders
//    */
//   private static async processTreatmentReminders(reminders: any[]) {
//     for (const reminder of reminders) {
//       try {
//         const { prescribedTreatment } = reminder;
//         // Create notification for the vet who prescribed the treatment
//         await prisma.notification.create({
//           data: {
//             title: 'Treatment Reminder',
//             message: `Time to administer ${prescribedTreatment.medicationName} to ${prescribedTreatment.livestock.tagId}`,
//             type: NotificationType.TREATMENT_REMINDER,
//             recipientId: prescribedTreatment.recordedById,
//             relatedEntityType: 'PRESCRIBED_TREATMENT',
//             relatedEntityId: prescribedTreatment.id,
//             metadata: {
//               treatmentId: prescribedTreatment.id,
//               livestockTag: prescribedTreatment.livestock.tagId,
//               medication: prescribedTreatment.medicationName,
//               dosage: prescribedTreatment.dosage,
//               frequency: prescribedTreatment.frequency
//             }
//           }
//         });
//         // Also notify farm staff if it's an active treatment
//         if (prescribedTreatment.isActive) {
//           await this.notifyFarmStaffAboutTreatment(prescribedTreatment);
//         }
//         // Mark reminder as sent
//         await prisma.treatmentReminder.update({
//           where: { id: reminder.id },
//           data: { 
//             isSent: true,
//             sentAt: new Date()
//           }
//         });
//         console.log(`Sent treatment reminder for ${prescribedTreatment.medicationName}`);
//       } catch (error) {
//         console.error(`Error processing treatment reminder ${reminder.id}:`, error);
//       }
//     }
//   }
//   /**
//    * Process due follow-up reminders
//    */
//   private static async processFollowUpReminders(reminders: any[]) {
//     for (const reminder of reminders) {
//       try {
//         const { followUp } = reminder;
//         // Notify the vet who scheduled the follow-up
//         await prisma.notification.create({
//           data: {
//             title: 'Follow-up Reminder',
//             message: `Follow-up reminder: ${followUp.reason} for ${followUp.relatedAnimal.tagId}`,
//             type: NotificationType.FOLLOW_UP_REMINDER,
//             recipientId: followUp.recordedById,
//             relatedEntityType: 'FOLLOW_UP',
//             relatedEntityId: followUp.id,
//             metadata: {
//               followUpId: followUp.id,
//               animalTag: followUp.relatedAnimal.tagId,
//               reason: followUp.reason,
//               date: followUp.date,
//               location: followUp.location
//             }
//           }
//         });
//         // Notify farm staff if enabled
//         if (followUp.notifyFarmStaff) {
//           await this.notifyFarmStaffAboutFollowUp(followUp);
//         }
//         // Mark reminder as sent
//         await prisma.followUpReminder.update({
//           where: { id: reminder.id },
//           data: { 
//             isSent: true,
//             sentAt: new Date()
//           }
//         });
//         console.log(`Sent follow-up reminder for ${followUp.relatedAnimal.tagId}`);
//       } catch (error) {
//         console.error(`Error processing follow-up reminder ${reminder.id}:`, error);
//       }
//     }
//   }
//   /**
//    * Notify farm staff about treatment reminders
//    */
//   private static async notifyFarmStaffAboutTreatment(prescribedTreatment: any) {
//     try {
//       const farmStaff = await prisma.user.findMany({
//         where: {
//           companyName: prescribedTreatment.livestock.addedBy.companyName,
//           role: { in: ['ADMIN', 'FARM_KEEPER'] }
//         }
//       });
//       // Create proper notification data with correct types
//       const notifications = farmStaff.map(staff => ({
//         title: 'Treatment Administration Due',
//         message: `Time to administer ${prescribedTreatment.medicationName} to ${prescribedTreatment.livestock.tagId}`,
//         type: NotificationType.TREATMENT_REMINDER as NotificationType,
//         status: NotificationStatus.UNREAD as NotificationStatus,
//         recipientId: staff.id,
//         relatedEntityType: 'PRESCRIBED_TREATMENT',
//         relatedEntityId: prescribedTreatment.id,
//         metadata: {
//           treatmentId: prescribedTreatment.id,
//           livestockTag: prescribedTreatment.livestock.tagId,
//           medication: prescribedTreatment.medicationName,
//           dosage: prescribedTreatment.dosage
//         }
//       }));
//       await prisma.notification.createMany({
//         data: notifications
//       });
//       console.log(`Notified ${farmStaff.length} farm staff about treatment`);
//     } catch (error) {
//       console.error('Error notifying farm staff about treatment:', error);
//     }
//   }
//   /**
//    * Notify farm staff about follow-up
//    */
//   private static async notifyFarmStaffAboutFollowUp(followUp: any) {
//     try {
//       const farmStaff = await prisma.user.findMany({
//         where: {
//           companyName: followUp.relatedFarm,
//           role: { in: ['ADMIN', 'FARM_KEEPER'] }
//         }
//       });
//       // Create proper notification data with correct types
//       const notifications = farmStaff.map(staff => ({
//         title: 'Follow-up Scheduled',
//         message: `Veterinary follow-up scheduled for ${followUp.relatedAnimal.tagId} on ${followUp.date.toLocaleDateString()}`,
//         type: NotificationType.FOLLOW_UP_REMINDER as NotificationType,
//         status: NotificationStatus.UNREAD as NotificationStatus,
//         recipientId: staff.id,
//         relatedEntityType: 'FOLLOW_UP',
//         relatedEntityId: followUp.id,
//         metadata: {
//           followUpId: followUp.id,
//           animalTag: followUp.relatedAnimal.tagId,
//           date: followUp.date,
//           reason: followUp.reason,
//           location: followUp.location
//         }
//       }));
//       await prisma.notification.createMany({
//         data: notifications
//       });
//       console.log(`Notified ${farmStaff.length} farm staff about follow-up`);
//     } catch (error) {
//       console.error('Error notifying farm staff about follow-up:', error);
//     }
//   }
// }
