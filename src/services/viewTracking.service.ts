// services/viewTracking.service.ts
import prisma from "../prisma";
import { Prisma, PropertyListingStatus } from "@prisma/client";
import Logger from "../config/logger";

export class ViewTrackingService {

  static async trackView(propertyId: string, userId?: string): Promise<void> {
    try {
      const property = await prisma.property.findUnique({
        where: { 
          id: propertyId,
          listingStatus: PropertyListingStatus.ACTIVE
        },
        select: { id: true, name: true, vendorId: true }
      });

      if (!property) {
        Logger.warn(`Attempted to track view for non-existent property: ${propertyId}`);
        return;
      }

      await prisma.propertyView.create({
        data: {
          propertyId,
          viewerId: userId || null,
          viewedAt: new Date()
        }
      });

      await prisma.property.update({
        where: { id: propertyId },
        data: { viewCount: { increment: 1 } }
      });

      Logger.debug(`View tracked for property ${propertyId} by ${userId || 'anonymous'}`);
    } catch (error) {
      Logger.error('Failed to track property view:', error);
    }
  }

  static async trackMultipleViews(propertyIds: string[], userId?: string): Promise<void> {
    try {
      for (const propertyId of propertyIds) {
        await this.trackView(propertyId, userId);
      }
    } catch (error) {
      Logger.error('Failed to track multiple property views:', error);
    }
  }

  static async getVendorViewStats(vendorId: string): Promise<any> {
    const properties = await prisma.property.findMany({
      where: { vendorId },
      select: {
        id: true,
        name: true,
        viewCount: true,
        inquiryCount: true,
        listingStatus: true,
        createdAt: true
      },
      orderBy: { viewCount: 'desc' }
    });

    if (properties.length === 0) {
      return {
        totalViews: 0,
        totalInquiries: 0,
        propertiesCount: 0,
        weeklyPerformance: [],
        topProperties: []
      };
    }

    const propertyIds = properties.map(p => p.id);
    const totalViews = properties.reduce((sum, p) => sum + p.viewCount, 0);
    const totalInquiries = properties.reduce((sum, p) => sum + p.inquiryCount, 0);
    const weeklyPerformance = await this.getWeeklyPerformance(propertyIds);

    const topProperties = properties.slice(0, 5).map(p => ({
      id: p.id,
      name: p.name,
      views: p.viewCount,
      inquiries: p.inquiryCount,
      status: p.listingStatus
    }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayViews = await prisma.propertyView.count({
      where: {
        propertyId: { in: propertyIds },
        viewedAt: { gte: today }
      }
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyViews = await prisma.propertyView.count({
      where: {
        propertyId: { in: propertyIds },
        viewedAt: { gte: weekAgo }
      }
    });

    return {
      summary: {
        totalViews,
        totalInquiries,
        todayViews,
        weeklyViews,
        propertiesCount: properties.length
      },
      weeklyPerformance,
      topProperties
    };
  }

  /**
   * INDUSTRY STANDARD: Using Prisma.join() with proper typing
   * This is the recommended approach for Prisma v5+
   */
  private static async getWeeklyPerformance(propertyIds: string[]): Promise<any[]> {
    const weeks = 12;
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - (weeks * 7));

    // ✅ Industry Standard: Using Prisma.join() with type safety
    const weeklyViews = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE_TRUNC('week', "viewedAt") as week_start,
        COUNT(*) as view_count
      FROM "PropertyView"
      WHERE "propertyId" IN (${Prisma.join(propertyIds)})
        AND "viewedAt" >= ${startDate}
      GROUP BY DATE_TRUNC('week', "viewedAt")
      ORDER BY week_start ASC
    `;

    const weeklyInquiries = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE_TRUNC('week', "createdAt") as week_start,
        COUNT(*) as inquiry_count
      FROM "Inquiry"
      WHERE "propertyId" IN (${Prisma.join(propertyIds)})
        AND "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC('week', "createdAt")
      ORDER BY week_start ASC
    `;

    // Generate weekly data
    const result = [];
    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + (i * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const viewData = weeklyViews.find(
        (item: any) => {
          const itemDate = new Date(item.week_start);
          return itemDate >= weekStart && itemDate <= weekEnd;
        }
      );

      const inquiryData = weeklyInquiries.find(
        (item: any) => {
          const itemDate = new Date(item.week_start);
          return itemDate >= weekStart && itemDate <= weekEnd;
        }
      );

      result.push({
        date: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        month: weekStart.toLocaleDateString('en-US', { month: 'short' }),
        year: weekStart.getFullYear(),
        totalViews: viewData?.view_count || 0,
        totalInquiries: inquiryData?.inquiry_count || 0
      });
    }

    return result;
  }
}