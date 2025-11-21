"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyFarmStaffAboutAppointment = exports.createAppointmentReminders = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const createAppointmentReminders = async (appointment) => {
    try {
        const appointmentDate = new Date(appointment.date);
        // 1 day before reminder (at 9 AM)
        const oneDayBefore = new Date(appointmentDate);
        oneDayBefore.setDate(oneDayBefore.getDate() - 1);
        oneDayBefore.setHours(9, 0, 0, 0);
        // 1 hour before reminder
        const oneHourBefore = new Date(appointmentDate);
        oneHourBefore.setHours(oneHourBefore.getHours() - 1);
        await prisma_1.default.appointmentReminder.createMany({
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
    }
    catch (error) {
        console.error('Error creating appointment reminders:', error);
    }
};
exports.createAppointmentReminders = createAppointmentReminders;
const notifyFarmStaffAboutAppointment = async (appointment, companyId) => {
    try {
        const farmStaff = await prisma_1.default.user.findMany({
            where: {
                companyId: companyId,
                role: { in: ['ADMIN', 'FARM_KEEPER', 'COWORKER'] }
            }
        });
        if (farmStaff.length === 0) {
            console.log(`ℹ️ No farm staff found to notify for ${appointment.relatedFarm}`);
            return;
        }
        const notifications = farmStaff.map(staff => ({
            title: 'New Appointment Scheduled',
            message: `Dr. ${appointment.recordedBy.fullName} has scheduled a ${appointment.visitType.toLowerCase()}: ${appointment.title}`,
            type: client_1.NotificationType.APPOINTMENT_REMINDER,
            status: client_1.NotificationStatus.UNREAD,
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
        }));
        await prisma_1.default.notification.createMany({
            data: notifications
        });
        console.log(`Notified ${farmStaff.length} farm staff about appointment`);
    }
    catch (error) {
        console.error('Error notifying farm staff about appointment:', error);
    }
};
exports.notifyFarmStaffAboutAppointment = notifyFarmStaffAboutAppointment;
