// src/services/reminder.service.ts
import prisma from '../prisma';
import { NotificationType, NotificationStatus } from '@prisma/client';

export class ReminderService {
  /**
   * Check and process all due reminders
   */
  static async checkDueReminders() {
    try {
      const now = new Date();
      
      console.log(`Checking due reminders at ${now.toISOString()}`);

      // Check treatment reminders
      const dueTreatmentReminders = await prisma.treatmentReminder.findMany({
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
      const dueFollowUpReminders = await prisma.followUpReminder.findMany({
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

      console.log(`Processed ${dueTreatmentReminders.length} treatment reminders and ${dueFollowUpReminders.length} follow-up reminders`);

    } catch (error) {
      console.error('Error checking due reminders:', error);
    }
  }

  /**
   * Process due treatment reminders
   */
  private static async processTreatmentReminders(reminders: any[]) {
    for (const reminder of reminders) {
      try {
        const { prescribedTreatment } = reminder;
        
        // Create notification for the vet who prescribed the treatment
        await prisma.notification.create({
          data: {
            title: 'Treatment Reminder',
            message: `Time to administer ${prescribedTreatment.medicationName} to ${prescribedTreatment.livestock.tagId}`,
            type: NotificationType.TREATMENT_REMINDER,
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
          }
        });

        // Also notify farm staff if it's an active treatment
        if (prescribedTreatment.isActive) {
          await this.notifyFarmStaffAboutTreatment(prescribedTreatment);
        }

        // Mark reminder as sent
        await prisma.treatmentReminder.update({
          where: { id: reminder.id },
          data: { 
            isSent: true,
            sentAt: new Date()
          }
        });

        console.log(`Sent treatment reminder for ${prescribedTreatment.medicationName}`);

      } catch (error) {
        console.error(`Error processing treatment reminder ${reminder.id}:`, error);
      }
    }
  }

  /**
   * Process due follow-up reminders
   */
  private static async processFollowUpReminders(reminders: any[]) {
    for (const reminder of reminders) {
      try {
        const { followUp } = reminder;
        
        // Notify the vet who scheduled the follow-up
        await prisma.notification.create({
          data: {
            title: 'Follow-up Reminder',
            message: `Follow-up reminder: ${followUp.reason} for ${followUp.relatedAnimal.tagId}`,
            type: NotificationType.FOLLOW_UP_REMINDER,
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
          }
        });

        // Notify farm staff if enabled
        if (followUp.notifyFarmStaff) {
          await this.notifyFarmStaffAboutFollowUp(followUp);
        }

        // Mark reminder as sent
        await prisma.followUpReminder.update({
          where: { id: reminder.id },
          data: { 
            isSent: true,
            sentAt: new Date()
          }
        });

        console.log(`Sent follow-up reminder for ${followUp.relatedAnimal.tagId}`);

      } catch (error) {
        console.error(`Error processing follow-up reminder ${reminder.id}:`, error);
      }
    }
  }

  /**
   * Notify farm staff about treatment reminders
   */
  private static async notifyFarmStaffAboutTreatment(prescribedTreatment: any) {
    try {
      const farmStaff = await prisma.user.findMany({
        where: {
          companyName: prescribedTreatment.livestock.addedBy.companyName,
          role: { in: ['ADMIN', 'FARM_KEEPER'] }
        }
      });

      // Create proper notification data with correct types
      const notifications = farmStaff.map(staff => ({
        title: 'Treatment Administration Due',
        message: `Time to administer ${prescribedTreatment.medicationName} to ${prescribedTreatment.livestock.tagId}`,
        type: NotificationType.TREATMENT_REMINDER as NotificationType,
        status: NotificationStatus.UNREAD as NotificationStatus,
        recipientId: staff.id,
        relatedEntityType: 'PRESCRIBED_TREATMENT',
        relatedEntityId: prescribedTreatment.id,
        metadata: {
          treatmentId: prescribedTreatment.id,
          livestockTag: prescribedTreatment.livestock.tagId,
          medication: prescribedTreatment.medicationName,
          dosage: prescribedTreatment.dosage
        }
      }));

      await prisma.notification.createMany({
        data: notifications
      });

      console.log(`Notified ${farmStaff.length} farm staff about treatment`);

    } catch (error) {
      console.error('Error notifying farm staff about treatment:', error);
    }
  }

  /**
   * Notify farm staff about follow-up
   */
  private static async notifyFarmStaffAboutFollowUp(followUp: any) {
    try {
      const farmStaff = await prisma.user.findMany({
        where: {
          companyName: followUp.relatedFarm,
          role: { in: ['ADMIN', 'FARM_KEEPER'] }
        }
      });

      // Create proper notification data with correct types
      const notifications = farmStaff.map(staff => ({
        title: 'Follow-up Scheduled',
        message: `Veterinary follow-up scheduled for ${followUp.relatedAnimal.tagId} on ${followUp.date.toLocaleDateString()}`,
        type: NotificationType.FOLLOW_UP_REMINDER as NotificationType,
        status: NotificationStatus.UNREAD as NotificationStatus,
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
      }));

      await prisma.notification.createMany({
        data: notifications
      });

      console.log(`Notified ${farmStaff.length} farm staff about follow-up`);

    } catch (error) {
      console.error('Error notifying farm staff about follow-up:', error);
    }
  }
}