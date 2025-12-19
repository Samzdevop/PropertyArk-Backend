"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVetStatistics = getVetStatistics;
const prisma_1 = __importDefault(require("../prisma"));
async function getVetStatistics() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    // Get completed tasks with their duration
    const completedTasks = await prisma_1.default.task.findMany({
        where: {
            assignedTo: {
                role: 'VET'
            },
            status: 'COMPLETED',
            updatedAt: {
                gte: thirtyDaysAgo
            }
        },
        select: {
            createdAt: true,
            updatedAt: true
        }
    });
    // Calculate average completion time in JavaScript
    let avgTaskCompletionTime = 0;
    if (completedTasks.length > 0) {
        const totalDays = completedTasks.reduce((sum, task) => {
            const durationMs = task.updatedAt.getTime() - task.createdAt.getTime();
            return sum + (durationMs / (1000 * 60 * 60 * 24)); // Convert to days
        }, 0);
        avgTaskCompletionTime = totalDays / completedTasks.length;
    }
    const [tasksCompleted, companiesAssigned, activeAssignments] = await Promise.all([
        prisma_1.default.task.count({
            where: {
                assignedTo: {
                    role: 'VET'
                },
                status: 'COMPLETED',
                updatedAt: {
                    gte: thirtyDaysAgo
                }
            }
        }),
        // Number of unique companies vets are assigned to
        prisma_1.default.task.groupBy({
            by: ['assignedById'],
            where: {
                assignedTo: {
                    role: 'VET'
                },
                status: { in: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] }
            },
            _count: {
                _all: true
            }
        }).then(results => results.length),
        // Current active assignments
        prisma_1.default.task.count({
            where: {
                assignedTo: {
                    role: 'VET'
                },
                status: { in: ['PENDING', 'IN_PROGRESS'] }
            }
        })
    ]);
    return {
        tasksCompletedLast30Days: tasksCompleted,
        avgTaskCompletionDays: Math.round(avgTaskCompletionTime * 100) / 100,
        uniqueCompaniesAssigned: companiesAssigned,
        currentActiveAssignments: activeAssignments
    };
}
