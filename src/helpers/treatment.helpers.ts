import { NotificationService } from '../services/notification.services';
import prisma from '../prisma';
import { NotificationType, NotificationStatus } from '@prisma/client';

export class TreatmentHelpers {
  /**
   * Create comprehensive treatment reminders based on frequency
   */
  static async createTreatmentReminders(prescribedTreatment: any) {
    try {
      const { id, frequency, startDate, endDate } = prescribedTreatment;
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000); // Default 1 week

      let reminders: any[] = [];

      switch (frequency) {
        case 'DAILY':
          reminders = this.generateDailyReminders(id, start, end);
          break;
        case 'TWICE_DAILY':
          reminders = this.generateTwiceDailyReminders(id, start, end);
          break;
        case 'EVERY_OTHER_DAY':
          reminders = this.generateEveryOtherDayReminders(id, start, end);
          break;
        case 'WEEKLY':
          reminders = this.generateWeeklyReminders(id, start, end);
          break;
        case 'BI_WEEKLY':
          reminders = this.generateBiWeeklyReminders(id, start, end);
          break;
        case 'MONTHLY':
          reminders = this.generateMonthlyReminders(id, start, end);
          break;
        case 'AS_NEEDED':
          reminders = this.generateAsNeededReminders(id, start);
          break;
      }

      if (reminders.length > 0) {
        await prisma.treatmentReminder.createMany({
          data: reminders
        });
      }

      console.log(`Created ${reminders.length} treatment reminders for frequency: ${frequency}`);

    } catch (error) {
      console.error('Error creating treatment reminders:', error);
    }
  }

  /**
   * Generate daily reminders (once per day at 8 AM)
   */
  private static generateDailyReminders(treatmentId: string, start: Date, end: Date) {
    const reminders = [];
    const current = new Date(start);
    
    while (current <= end) {
      const reminderDate = new Date(current);
      reminderDate.setHours(8, 0, 0, 0); // 8:00 AM
      
      reminders.push({
        prescribedTreatmentId: treatmentId,
        reminderType: 'DAILY',
        dueDate: reminderDate,
        isSent: false
      });

      current.setDate(current.getDate() + 1);
    }

    return reminders;
  }

  /**
   * Generate twice daily reminders (8 AM and 6 PM)
   */
  private static generateTwiceDailyReminders(treatmentId: string, start: Date, end: Date) {
    const reminders = [];
    const current = new Date(start);
    
    while (current <= end) {
      // Morning reminder (8 AM)
      const morningReminder = new Date(current);
      morningReminder.setHours(8, 0, 0, 0);
      
      // Evening reminder (6 PM)
      const eveningReminder = new Date(current);
      eveningReminder.setHours(18, 0, 0, 0);
      
      reminders.push(
        {
          prescribedTreatmentId: treatmentId,
          reminderType: 'MORNING',
          dueDate: morningReminder,
          isSent: false
        },
        {
          prescribedTreatmentId: treatmentId,
          reminderType: 'EVENING',
          dueDate: eveningReminder,
          isSent: false
        }
      );

      current.setDate(current.getDate() + 1);
    }

    return reminders;
  }

  /**
   * Generate every other day reminders
   */
  private static generateEveryOtherDayReminders(treatmentId: string, start: Date, end: Date) {
    const reminders = [];
    const current = new Date(start);
    
    while (current <= end) {
      const reminderDate = new Date(current);
      reminderDate.setHours(10, 0, 0, 0); // 10:00 AM
      
      reminders.push({
        prescribedTreatmentId: treatmentId,
        reminderType: 'EVERY_OTHER_DAY',
        dueDate: reminderDate,
        isSent: false
      });

      current.setDate(current.getDate() + 2);
    }

    return reminders;
  }

  /**
   * Generate weekly reminders
   */
  private static generateWeeklyReminders(treatmentId: string, start: Date, end: Date) {
    const reminders = [];
    const current = new Date(start);
    
    while (current <= end) {
      const reminderDate = new Date(current);
      reminderDate.setHours(9, 0, 0, 0); // 9:00 AM
      
      reminders.push({
        prescribedTreatmentId: treatmentId,
        reminderType: 'WEEKLY',
        dueDate: reminderDate,
        isSent: false
      });

      current.setDate(current.getDate() + 7);
    }

    return reminders;
  }

  /**
   * Generate bi-weekly reminders
   */
  private static generateBiWeeklyReminders(treatmentId: string, start: Date, end: Date) {
    const reminders = [];
    const current = new Date(start);
    
    while (current <= end) {
      const reminderDate = new Date(current);
      reminderDate.setHours(9, 0, 0, 0); // 9:00 AM
      
      reminders.push({
        prescribedTreatmentId: treatmentId,
        reminderType: 'BI_WEEKLY',
        dueDate: reminderDate,
        isSent: false
      });

      current.setDate(current.getDate() + 14);
    }

    return reminders;
  }

  /**
   * Generate monthly reminders
   */
  private static generateMonthlyReminders(treatmentId: string, start: Date, end: Date) {
    const reminders = [];
    const current = new Date(start);
    
    while (current <= end) {
      const reminderDate = new Date(current);
      reminderDate.setHours(10, 0, 0, 0); // 10:00 AM
      
      reminders.push({
        prescribedTreatmentId: treatmentId,
        reminderType: 'MONTHLY',
        dueDate: reminderDate,
        isSent: false
      });

      current.setMonth(current.getMonth() + 1);
    }

    return reminders;
  }

  /**
   * Generate single reminder for as-needed treatments
   */
  private static generateAsNeededReminders(treatmentId: string, start: Date) {
    const reminderDate = new Date(start);
    reminderDate.setHours(12, 0, 0, 0); // 12:00 PM
    
    return [{
      prescribedTreatmentId: treatmentId,
      reminderType: 'AS_NEEDED',
      dueDate: reminderDate,
      isSent: false
    }];
  }

  /**
   * Create follow-up reminders (1 day before and 1 hour before)
   */
  static async createFollowUpReminders(followUp: any) {
    try {
      const followUpDate = new Date(followUp.date);
      
      // 1 day before reminder (at 9 AM)
      const oneDayBefore = new Date(followUpDate);
      oneDayBefore.setDate(oneDayBefore.getDate() - 1);
      oneDayBefore.setHours(9, 0, 0, 0);
      
      // 1 hour before reminder
      const oneHourBefore = new Date(followUpDate);
      oneHourBefore.setHours(oneHourBefore.getHours() - 1);

      await prisma.followUpReminder.createMany({
        data: [
          {
            followUpId: followUp.id,
            reminderType: '1_DAY_BEFORE',
            dueDate: oneDayBefore,
            isSent: false
          },
          {
            followUpId: followUp.id,
            reminderType: '1_HOUR_BEFORE',
            dueDate: oneHourBefore,
            isSent: false
          }
        ]
      });

      console.log(`Created follow-up reminders for ${followUp.relatedAnimal.tagId}`);

    } catch (error) {
      console.error('Error creating follow-up reminders:', error);
    }
  }

  /**
   * Notify farm staff about scheduled follow-up
   */
  static async notifyFarmStaffAboutFollowUp(followUp: any, animal: any) {
    try {
      const farmStaff = await prisma.user.findMany({
        where: {
          companyName: followUp.relatedFarm,
          role: { in: ['ADMIN', 'FARM_KEEPER'] }
        }
      });

      if (farmStaff.length === 0) {
        console.log(`No farm staff found to notify for ${followUp.relatedFarm}`);
        return;
      }

         for (const staff of farmStaff) {
        // Check if user wants follow-up notifications
        const shouldNotify = await NotificationService.shouldSendNotification(
          staff.id, 
          'FOLLOW_UP_REMINDER'
        );

        if (!shouldNotify) {
          console.log(`Skipping follow-up notification for user ${staff.id} - notifications disabled`);
          continue;
        }

      // Create properly typed notification data
      // const notifications = farmStaff.map(staff => {
      //   const notificationData = {
      //     title: 'Veterinary Follow-up Scheduled',
      //     message: `Dr. ${followUp.recordedBy.fullName} has scheduled a follow-up for ${animal.tagId} on ${followUp.date.toLocaleDateString()} at ${followUp.location}`,
      //     type: NotificationType.FOLLOW_UP_REMINDER,
      //     status: NotificationStatus.UNREAD,
      //     recipientId: staff.id,
      //     relatedEntityType: 'FOLLOW_UP',
      //     relatedEntityId: followUp.id,
      //     metadata: {
      //       followUpId: followUp.id,
      //       animalTag: animal.tagId,
      //       date: followUp.date,
      //       time: followUp.time,
      //       reason: followUp.reason,
      //       location: followUp.location,
      //       vetName: followUp.recordedBy.fullName
      //     }
      //   };
      //   return notificationData;
      // });

        await NotificationService.createNotification({
          title: 'Veterinary Follow-up Scheduled',
          message: `Dr. ${followUp.recordedBy.fullName} has scheduled a follow-up for ${animal.tagId} on ${followUp.date.toLocaleDateString()} at ${followUp.location}`,
          type: NotificationType.FOLLOW_UP_REMINDER,
          status: NotificationStatus.UNREAD,
          recipientId: staff.id,
          relatedEntityType: 'FOLLOW_UP',
          relatedEntityId: followUp.id,
          metadata: {
            followUpId: followUp.id,
            animalTag: animal.tagId,
            date: followUp.date,
            time: followUp.time,
            reason: followUp.reason,
            location: followUp.location,
            vetName: followUp.recordedBy.fullName
          }
        });
      }
      // await prisma.notification.createMany({
      //   data: notifications
      // });

      console.log(`Notified ${farmStaff.length} farm staff about follow-up for ${animal.tagId}`);

    } catch (error) {
      console.error('Error notifying farm staff about follow-up:', error);
    }
  }
}