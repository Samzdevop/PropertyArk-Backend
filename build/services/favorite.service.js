"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FavoriteService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const NotFoundError_1 = require("../errors/NotFoundError");
const BadRequestError_1 = require("../errors/BadRequestError");
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../config/logger"));
class FavoriteService {
    static async addFavorite(userId, propertyId) {
        const property = await prisma_1.default.property.findUnique({
            where: {
                id: propertyId,
                listingStatus: client_1.PropertyListingStatus.ACTIVE
            },
            select: { id: true, name: true, listingStatus: true }
        });
        if (!property) {
            throw new NotFoundError_1.NotFoundError("Property not found or not available");
        }
        const existingFavorite = await prisma_1.default.favorite.findUnique({
            where: {
                userId_propertyId: {
                    userId,
                    propertyId
                }
            }
        });
        if (existingFavorite) {
            throw new BadRequestError_1.BadRequestError("Property already in favorites");
        }
        const favorite = await prisma_1.default.favorite.create({
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
        logger_1.default.info(`User ${userId} added property ${propertyId} to favorites`);
        return favorite;
    }
    static async removeFavorite(userId, propertyId) {
        const favorite = await prisma_1.default.favorite.findUnique({
            where: {
                userId_propertyId: {
                    userId,
                    propertyId
                }
            }
        });
        if (!favorite) {
            throw new NotFoundError_1.NotFoundError("Property not in favorites");
        }
        await prisma_1.default.favorite.delete({
            where: {
                userId_propertyId: {
                    userId,
                    propertyId
                }
            }
        });
        logger_1.default.info(`User ${userId} removed property ${propertyId} from favorites`);
    }
    static async getUserFavorites(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const take = limit;
        const [favorites, total] = await Promise.all([
            prisma_1.default.favorite.findMany({
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
            prisma_1.default.favorite.count({ where: { userId } })
        ]);
        const enrichedFavorites = favorites.map((fav) => ({
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
    static async isFavorite(userId, propertyId) {
        const favorite = await prisma_1.default.favorite.findUnique({
            where: {
                userId_propertyId: {
                    userId,
                    propertyId
                }
            }
        });
        return !!favorite;
    }
    static async getFavoriteCount(propertyId) {
        return prisma_1.default.favorite.count({
            where: { propertyId }
        });
    }
    static getPriceDisplay(property) {
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
exports.FavoriteService = FavoriteService;
