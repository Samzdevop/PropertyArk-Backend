import prisma from "../prisma";
import { NotFoundError } from "../errors/NotFoundError";
import { ForbiddenError } from "../errors/ForbiddenError";
import { BadRequestError } from "../errors/BadRequestError";
import { Role, PropertyListingStatus } from "@prisma/client";
import Logger from "../config/logger";

export class FavoriteService {
  

  static async addFavorite(userId: string, propertyId: string): Promise<any> {
    const property = await prisma.property.findUnique({
      where: { 
        id: propertyId,
        listingStatus: PropertyListingStatus.ACTIVE
      },
      select: { id: true, name: true, listingStatus: true }
    });

    if (!property) {
      throw new NotFoundError("Property not found or not available");
    }

    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_propertyId: {
          userId,
          propertyId
        }
      }
    });

    if (existingFavorite) {
      throw new BadRequestError("Property already in favorites");
    }

    const favorite = await prisma.favorite.create({
      data: {
        userId,
        propertyId
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            listingType: true,
            city: true,
            state: true,
            rentAmount: true,
            salePrice: true,
            landFee: true,
            shortletAmount: true,
            media: {
              take: 1,
              where: { isPrimary: true },
              select: { url: true }
            }
          }
        }
      }
    });

    Logger.info(`User ${userId} added property ${propertyId} to favorites`);
    return favorite;
  }

  static async removeFavorite(userId: string, propertyId: string): Promise<void> {
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_propertyId: {
          userId,
          propertyId
        }
      }
    });

    if (!favorite) {
      throw new NotFoundError("Property not in favorites");
    }

    await prisma.favorite.delete({
      where: {
        userId_propertyId: {
          userId,
          propertyId
        }
      }
    });

    Logger.info(`User ${userId} removed property ${propertyId} from favorites`);
  }


  static async getUserFavorites(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const skip = (page - 1) * limit;
    const take = limit;

    const [favorites, total] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            include: {
              media: {
                where: { isPrimary: true },
                take: 1,
                select: { url: true }
              },
              vendor: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                  avatar: true
                }
              },
              _count: {
                select: {
                  favorites: true,
                  inquiries: true
                }
              }
            }
          }
        }
      }),
      prisma.favorite.count({ where: { userId } })
    ]);

    const enrichedFavorites = favorites.map((fav:any) => ({
      id: fav.id,
      createdAt: fav.createdAt,
      property: {
        ...fav.property,
        priceDisplay: this.getPriceDisplay(fav.property),
        favoritesCount: fav.property._count.favorites,
        inquiriesCount: fav.property._count.inquiries
      }
    }));

    return {
      favorites: enrichedFavorites,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  static async isFavorite(userId: string, propertyId: string): Promise<boolean> {
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_propertyId: {
          userId,
          propertyId
        }
      }
    });

    return !!favorite;
  }


  static async getFavoriteCount(propertyId: string): Promise<number> {
    return prisma.favorite.count({
      where: { propertyId }
    });
  }


  private static getPriceDisplay(property: any): string {
    switch (property.listingType) {
      case 'FOR_RENT':
        return property.rentAmount ? `$${property.rentAmount.toLocaleString()}/month` : 'Contact for price';
      case 'FOR_SALE':
        return property.salePrice ? `$${property.salePrice.toLocaleString()}` : 'Contact for price';
      case 'FOR_LAND':
        return property.landFee ? `$${property.landFee.toLocaleString()}` : 'Contact for price';
      case 'FOR_SHORTLET':
        return property.shortletAmount ? `$${property.shortletAmount.toLocaleString()}/night` : 'Contact for price';
      default:
        return 'Contact for price';
    }
  }
}