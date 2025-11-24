import { NotificationService } from '../services/notification.services';
import prisma from '../prisma';
import { NotificationType, NotificationStatus } from '@prisma/client';

export  const createAppointmentReminders = async (appointment: any) => {
  try {
    const appointmentDate = new Date(appointment.date);
    
    // 1 day before reminder (at 9 AM)
    const oneDayBefore = new Date(appointmentDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    oneDayBefore.setHours(9, 0, 0, 0);
    
    // 1 hour before reminder
    const oneHourBefore = new Date(appointmentDate);
    oneHourBefore.setHours(oneHourBefore.getHours() - 1);

    await prisma.appointmentReminder.createMany({
      data: [
        {
          appointmentId: appointment.id,
          reminderType: '1_DAY_BEFORE',
          dueDate: oneDayBefore,
          isSent: false
        },
        {
          appointmentId: appointment.id,
          reminderType: '1_HOUR_BEFORE',
          dueDate: oneHourBefore,
          isSent: false
        }
      ]
    });

    console.log(`Created appointment reminders for ${appointment.title}`);

  } catch (error) {
    console.error('Error creating appointment reminders:', error);
  }
};

export const notifyFarmStaffAboutAppointment = async (appointment: any, companyId:string) => {
  try {
     const farmStaff = await prisma.user.findMany({
      where: {
        companyId: companyId,
        role: { in: ['ADMIN', 'FARM_KEEPER', 'COWORKER'] }
      }
    });


    if (farmStaff.length === 0) {
      console.log(`No farm staff found to notify for ${appointment.relatedFarm}`);
      return;
    }

      for (const staff of farmStaff) {
      // Check if user wants appointment notifications
      const shouldNotify = await NotificationService.shouldSendNotification(
        staff.id, 
        'APPOINTMENT_REMINDER'
      );

      if (!shouldNotify) {
        console.log(`Skipping appointment notification for user ${staff.id} - notifications disabled`);
        continue;
      }  

      await NotificationService.createNotification({
        title: 'New Appointment Scheduled',
        message: `Dr. ${appointment.recordedBy.fullName} has scheduled a ${appointment.visitType.toLowerCase()}: ${appointment.title}`,
        type: NotificationType.APPOINTMENT_REMINDER,
        status: NotificationStatus.UNREAD,
        recipientId: staff.id,
        relatedEntityType: 'APPOINTMENT',
        relatedEntityId: appointment.id,
        metadata: {
          appointmentId: appointment.id,
          title: appointment.title,
          visitType: appointment.visitType,
          date: appointment.date,
          purpose: appointment.purpose,
          vetName: appointment.recordedBy.fullName
        }
      });
    }
    // await prisma.notification.createMany({
    //   data: notifications
    // });

    console.log(`Notified ${farmStaff.length} farm staff about appointment`);

  } catch (error) {
    console.error('Error notifying farm staff about appointment:', error);
  }
};