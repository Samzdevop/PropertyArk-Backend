import { PrismaClient, Role, ListingType, PropertyStatus, PropertyListingStatus, PropertyType, VerificationStatus, MediaType, DocumentType, NotificationType } from '@prisma/client';
import { hash } from 'argon2';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

const SEED_CONFIG = {
  ADMIN_COUNT: 1,
  STAFF_COUNT: 2,
  VENDOR_COUNT: 4,
  USER_COUNT: 6,
  PROPERTIES_PER_VENDOR: 15,
  PASSWORD: 'Password123!',
};

const generateImageUrl = (category: string, index: number): string => {
  const images = {
    property: [
      'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
      'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800',
      'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800',
      'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
      'https://images.unsplash.com/photo-1505693314120-0d443867891c?w=800',
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800',
    ],
    avatar: [
      'https://randomuser.me/api/portraits/men/1.jpg',
      'https://randomuser.me/api/portraits/women/2.jpg',
      'https://randomuser.me/api/portraits/men/3.jpg',
      'https://randomuser.me/api/portraits/women/4.jpg',
      'https://randomuser.me/api/portraits/men/5.jpg',
      'https://randomuser.me/api/portraits/women/6.jpg',
      'https://randomuser.me/api/portraits/men/7.jpg',
      'https://randomuser.me/api/portraits/women/8.jpg',
      'https://randomuser.me/api/portraits/men/9.jpg',
      'https://randomuser.me/api/portraits/women/10.jpg',
      'https://randomuser.me/api/portraits/men/11.jpg',
      'https://randomuser.me/api/portraits/women/12.jpg',
    ]
  };

  const selectedImages = images[category as keyof typeof images] || images.property;
  return selectedImages[index % selectedImages.length];
};

const generateVideoUrl = (): string => {
  const videos = [
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  ];
  return videos[Math.floor(Math.random() * videos.length)];
};

const generateNinPhotoUrl = (index: number): string => {
  return `https://randomuser.me/api/portraits/med/${index % 2 === 0 ? 'men' : 'women'}/${index + 10}.jpg`;
};

const getRandomPropertyType = (): PropertyType => {
  const types = [
    PropertyType.RESIDENTIAL,
    PropertyType.COMMERCIAL,
    PropertyType.INDUSTRIAL,
    PropertyType.LAND,
    PropertyType.MIXED_USE
  ];
  return types[Math.floor(Math.random() * types.length)];
};

const getRandomListingType = (): ListingType => {
  const types = [
    ListingType.FOR_RENT,
    ListingType.FOR_SALE,
    ListingType.FOR_LAND,
    ListingType.FOR_SHORTLET
  ];
  return types[Math.floor(Math.random() * types.length)];
};

const getRandomPropertyStatus = (): PropertyStatus => {
  const statuses = [
    PropertyStatus.AVAILABLE,
    PropertyStatus.OCCUPIED,
    PropertyStatus.UNDER_MAINTENANCE,
    PropertyStatus.UNDER_CONSTRUCTION,
    PropertyStatus.SOLD,
    PropertyStatus.RENTED
  ];
  return statuses[Math.floor(Math.random() * statuses.length)];
};

const getRandomListingStatus = (index: number): PropertyListingStatus => {
  if (index % 5 === 0) return PropertyListingStatus.PENDING;
  if (index % 7 === 0) return PropertyListingStatus.REJECTED;
  return PropertyListingStatus.ACTIVE;
};

const getRandomAmenities = (): string[] => {
  const allAmenities = [
    'Pool', 'Gym', 'Parking', 'Elevator', 'Security', 'Pet Friendly',
    'Balcony', 'Garden', 'Terrace', 'Jacuzzi', 'Sauna', 'Tennis Court',
    'Clubhouse', 'Playground', 'BBQ Area', 'Fireplace', 'Central AC',
    'Washer/Dryer', 'Dishwasher', 'Smart Home', 'Solar Panels'
  ];
  const count = Math.floor(Math.random() * 6) + 2;
  return faker.helpers.arrayElements(allAmenities, count);
};

const getPricingByListingType = (listingType: ListingType): { rentAmount?: number; salePrice?: number; landFee?: number; shortletAmount?: number } => {
  switch (listingType) {
    case ListingType.FOR_RENT:
      return { rentAmount: faker.number.int({ min: 800, max: 5000 }) };
    case ListingType.FOR_SALE:
      return { salePrice: faker.number.int({ min: 100000, max: 2000000 }) };
    case ListingType.FOR_LAND:
      return { landFee: faker.number.int({ min: 20000, max: 500000 }) };
    case ListingType.FOR_SHORTLET:
      return { shortletAmount: faker.number.int({ min: 100, max: 500 }) };
    default:
      return {};
  }
};

const generatePropertyName = (index: number): string => {
  const prefixes = ['Luxury', 'Modern', 'Cozy', 'Spacious', 'Elegant', 'Charming', 'Grand', 'Serene', 'Vibrant', 'Tranquil'];
  const suffixes = ['Apartments', 'Villa', 'Mansion', 'Estate', 'Tower', 'Plaza', 'Gardens', 'Heights', 'Manor', 'Courtyard'];
  return `${prefixes[index % prefixes.length]} ${suffixes[(index + 3) % suffixes.length]} ${faker.location.city()}`;
};

async function main() {
  console.log(' Starting database seeding...');
  console.log('=' .repeat(60));

  console.log('\n Cleaning existing data...');

  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.media.deleteMany(),
    prisma.document.deleteMany(),
    prisma.property.deleteMany(),
    prisma.user.deleteMany(),
    prisma.systemConfig.deleteMany(),
    prisma.platformSettings.deleteMany(),
  ]);

  console.log('Existing data cleared');

  const hashedPassword = await hash(SEED_CONFIG.PASSWORD);

  console.log('\n👤 Creating Admin...');

  const admin = await prisma.user.create({
    data: {
      email: 'admin@property.com',
      password: hashedPassword,
      fullName: 'System Administrator',
      phone: '+1 (555) 000-0001',
      avatar: generateImageUrl('avatar', 0),
      location: 'New York, NY',
      role: Role.ADMIN,
      ninVerificationStatus: VerificationStatus.VERIFIED,
      isVerified: true,
    },
  });

  console.log(`Admin created: ${admin.email}`);

  console.log('\nCreating Staff members...');

  const staffMembers = [];
  const staffNames = [
    { fullName: 'Sarah Johnson', email: 'sarah.johnson@property.com', department: 'Property Management' },
    { fullName: 'Michael Chen', email: 'michael.chen@property.com', department: 'Sales' },
  ];

  for (let i = 0; i < staffNames.length; i++) {
    const staff = await prisma.user.create({
      data: {
        email: staffNames[i].email,
        password: hashedPassword,
        fullName: staffNames[i].fullName,
        phone: faker.phone.number({ style: 'international' }),
        avatar: generateImageUrl('avatar', i + 1),
        location: faker.location.city() + ', ' + faker.location.state({ abbreviated: true }),
        role: Role.STAFF,
        employeeId: `EMP${String(i + 1).padStart(4, '0')}`,
        department: staffNames[i].department,
        isVerified: true,
      },
    });
    staffMembers.push(staff);
    console.log(`Staff created: ${staff.fullName} (${staff.employeeId})`);
  }

  console.log('\n Creating Vendors...');

  const vendors = [];
  const vendorNames = [
    'Smith Properties',
    'Johnson Real Estate',
    'Williams Holdings',
    'Brown Investments'
  ];

  for (let i = 0; i < SEED_CONFIG.VENDOR_COUNT; i++) {
    const fullName = vendorNames[i] || faker.company.name();
    const email = `${fullName.toLowerCase().replace(/\s/g, '.')}@vendors.com`;

    const vendor = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: fullName,
        phone: faker.phone.number({ style: 'international' }),
        avatar: generateImageUrl('avatar', i + 3),
        location: faker.location.city() + ', ' + faker.location.state({ abbreviated: true }),
        role: Role.VENDOR,
        isVerified: true,
        ninPhotoUrl: generateNinPhotoUrl(i),
        ninVerificationStatus: VerificationStatus.VERIFIED,
        ninVerifiedAt: new Date(),
        ninVerifiedBy: admin.id,
      },
    });

    vendors.push(vendor);
    console.log(`Vendor created: ${vendor.fullName} (${vendor.email})`);
  }

  console.log('\n Creating Users...');

  const users = [];
  const userNames = [
    'John Doe', 'Jane Smith', 'Robert Wilson', 'Emily Davis',
    'Michael Brown', 'Lisa Anderson'
  ];

  for (let i = 0; i < SEED_CONFIG.USER_COUNT; i++) {
    const fullName = userNames[i] || faker.person.fullName();
    const email = `${fullName.toLowerCase().replace(/\s/g, '.')}@users.com`;

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName: fullName,
        phone: faker.phone.number({ style: 'international' }),
        avatar: generateImageUrl('avatar', i + 5),
        location: faker.location.city() + ', ' + faker.location.state({ abbreviated: true }),
        role: Role.USER,
        isVerified: true,
      },
    });

    users.push(user);
    console.log(` User created: ${user.fullName} (${user.email})`);
  }
  console.log('\n Creating properties...');

  let totalProperties = 0;
  const allProperties = [];

  for (const vendor of vendors) {
    console.log(`Creating properties for ${vendor.fullName}...`);

    for (let i = 0; i < SEED_CONFIG.PROPERTIES_PER_VENDOR; i++) {
      const listingType = getRandomListingType();
      const status = getRandomPropertyStatus();
      const listingStatus = getRandomListingStatus(i);
      const pricing = getPricingByListingType(listingType);

      const property = await prisma.property.create({
        data: {
          name: generatePropertyName(i),
          description: faker.lorem.paragraphs(2),
          type: getRandomPropertyType(),
          listingType: listingType,
          status: status,
          listingStatus: listingStatus,
          address: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state({ abbreviated: true }),
          country: 'USA',
          zipCode: faker.location.zipCode(),
          size: faker.number.float({ min: 500, max: 5000, fractionDigits: 0 }),
          sizeUnit: 'sqft',
          bedrooms: faker.number.int({ min: 1, max: 5 }),
          bathrooms: faker.number.int({ min: 1, max: 5}),
          yearBuilt: faker.number.int({ min: 1980, max: 2024 }),
          amenities: getRandomAmenities(),
          vendorId: vendor.id,
          staffId: Math.random() > 0.6 ? staffMembers[Math.floor(Math.random() * staffMembers.length)].id : null,

          ...pricing,
          ...(listingStatus === PropertyListingStatus.REJECTED && {
            rejectionReason: faker.helpers.arrayElement([
              'Property photos are not clear enough',
              'Missing required documentation',
              'Price is above market rate',
              'Incomplete property details',
              'Address verification failed'
            ]),
            reviewedBy: admin.id,
            reviewedAt: faker.date.recent({ days: 30 }),
          }),
          ...(listingStatus === PropertyListingStatus.ACTIVE && {
            reviewedBy: admin.id,
            reviewedAt: faker.date.recent({ days: 60 }),
          }),
        },
      });

      allProperties.push(property);
      totalProperties++;
      const imageCount = faker.number.int({ min: 3, max: 8 });
      const mediaData: any[] = [];

      for (let j = 0; j < imageCount; j++) {
        mediaData.push({
          name: `Property Image ${j + 1}`,
          type: MediaType.IMAGE,
          url: generateImageUrl('property', j + (i * 2)),
          key: `property-${property.id}-image-${j}.jpg`,
          size: faker.number.int({ min: 200000, max: 5000000 }),
          mimeType: 'image/jpeg',
          container: 'property-photos',
          propertyId: property.id,
          isPrimary: j === 0,
        });
      }
      if (Math.random() > 0.5) {
        mediaData.push({
          name: 'Property Tour Video',
          type: MediaType.VIDEO,
          url: generateVideoUrl(),
          key: `property-${property.id}-video.mp4`,
          size: faker.number.int({ min: 10000000, max: 50000000 }),
          mimeType: 'video/mp4',
          container: 'property-videos',
          propertyId: property.id,
          isPrimary: false,
        });
      }
      if (Math.random() > 0.7) {
        mediaData.push({
          name: 'Property Document',
          type: MediaType.DOCUMENT,
          url: `https://example.com/documents/property-${property.id}.pdf`,
          key: `property-${property.id}-doc.pdf`,
          size: faker.number.int({ min: 100000, max: 2000000 }),
          mimeType: 'application/pdf',
          container: 'property-documents',
          propertyId: property.id,
          isPrimary: false,
        });
      }

      if (mediaData.length > 0) {
        await prisma.media.createMany({ data: mediaData });
      }
      const notificationTypes = [
        NotificationType.PROPERTY_APPROVED,
        NotificationType.PROPERTY_REJECTED,
        NotificationType.GENERAL,
      ];

      const notificationCount = faker.number.int({ min: 1, max: 3 });
      for (let k = 0; k < notificationCount; k++) {
        const type = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
        let title, message;

        switch (type) {
          case NotificationType.PROPERTY_APPROVED:
            title = 'Property Approved';
            message = `Your property "${property.name}" has been approved and is now live.`;
            break;
          case NotificationType.PROPERTY_REJECTED:
            title = 'Property Rejected';
            message = `Your property "${property.name}" was rejected. ${property.rejectionReason || 'Please update and resubmit.'}`;
            break;
          default:
            title = 'Property Update';
            message = `Your property "${property.name}" has been ${property.listingStatus.toLowerCase()}.`;
        }

        await prisma.notification.create({
          data: {
            userId: vendor.id,
            type: type,
            title: title,
            message: message,
            data: { propertyId: property.id },
            read: Math.random() > 0.4,
            readAt: Math.random() > 0.4 ? faker.date.recent({ days: 10 }) : null,
            createdAt: faker.date.recent({ days: 60 }),
          },
        });
      }
    }

    console.log(`Created ${SEED_CONFIG.PROPERTIES_PER_VENDOR} properties for ${vendor.fullName}`);
  }

  console.log('\n Creating activity logs...');

  const allUsers = [admin, ...staffMembers, ...vendors, ...users];
  const actions = [
    'CREATE_PROPERTY', 'UPDATE_PROPERTY', 'REVIEW_PROPERTY',
    'LOGIN', 'LOGOUT', 'VIEW_PROPERTY',
    'VERIFY_VENDOR_NIN', 'REJECT_VENDOR_NIN', 'UPLOAD_NIN',
    'CREATE_STAFF', 'UPDATE_STAFF',
    'CREATE_PROPERTY', 'UPDATE_PROPERTY', 'DELETE_PROPERTY'
  ];

  const entityTypes = ['PROPERTY', 'USER', 'NIN', 'STAFF', 'PROPERTY_REVIEW'];

  for (let i = 0; i < 200; i++) {
    const user = allUsers[Math.floor(Math.random() * allUsers.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)];
    
    let entityId: string;
    if (entityType === 'PROPERTY' && allProperties.length > 0) {
      const randomProperty = allProperties[Math.floor(Math.random() * allProperties.length)];
      entityId = randomProperty.id;
    } else {
      entityId = user.id;
    }

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action,
        entityType,
        entityId: entityId,
        description: `${action} on ${entityType}`,
        details: {
          timestamp: new Date().toISOString(),
          userRole: user.role,
        },
        ipAddress: faker.internet.ip(),
        userAgent: faker.internet.userAgent(),
        createdAt: faker.date.recent({ days: 90 }),
      },
    });
  }

  console.log('Created 200+ activity logs');

  console.log('\n Creating documents...');

  for (const vendor of vendors) {
    await prisma.document.create({
      data: {
        name: `NIN_${vendor.fullName.replace(/\s/g, '_')}`,
        type: DocumentType.NIN,
        url: vendor.ninPhotoUrl || generateNinPhotoUrl(vendors.indexOf(vendor)),
        key: `nin-${vendor.id}-${Date.now()}.jpg`,
        size: faker.number.int({ min: 100000, max: 2000000 }),
        mimeType: 'image/jpeg',
        container: 'nin-documents',
        vendorId: vendor.id,
        uploadedById: vendor.id,
      },
    });

    if (Math.random() > 0.6) {
      await prisma.document.create({
        data: {
          name: `Identification_${vendor.fullName.replace(/\s/g, '_')}`,
          type: DocumentType.IDENTIFICATION,
          url: `https://example.com/documents/id-${vendor.id}.pdf`,
          key: `id-${vendor.id}-${Date.now()}.pdf`,
          size: faker.number.int({ min: 100000, max: 1000000 }),
          mimeType: 'application/pdf',
          container: 'vendor-documents',
          vendorId: vendor.id,
          uploadedById: vendor.id,
        },
      });
    }
  }

  for (const property of allProperties.slice(0, 20)) {
    if (Math.random() > 0.7) {
      await prisma.document.create({
        data: {
          name: `Deed_${property.name.replace(/\s/g, '_')}`,
          type: DocumentType.OTHER,
          url: `https://example.com/documents/deed-${property.id}.pdf`,
          key: `deed-${property.id}-${Date.now()}.pdf`,
          size: faker.number.int({ min: 50000, max: 500000 }),
          mimeType: 'application/pdf',
          container: 'property-documents',
          propertyId: property.id,
          uploadedById: property.vendorId,
        },
      });
    }
  }

  console.log('Created documents');

  console.log('\n Creating platform settings...');

  const settingsData = [
    {
      key: 'max_properties_per_vendor',
      value: 50,
      description: 'Maximum number of properties a vendor can list',
    },
    {
      key: 'nin_verification_required',
      value: true,
      description: 'Whether NIN verification is required for vendors',
    },
    {
      key: 'commission_rate',
      value: 0.05,
      description: 'Platform commission rate (5%)',
    },
    {
      key: 'max_media_per_property',
      value: 20,
      description: 'Maximum number of media files per property',
    },
    {
      key: 'property_approval_required',
      value: true,
      description: 'Whether admin approval is required for new properties',
    },
    {
      key: 'currency',
      value: 'USD',
      description: 'Default currency for the platform',
    },
    {
      key: 'timezone',
      value: 'America/New_York',
      description: 'Default timezone for the platform',
    },
  ];

  for (const setting of settingsData) {
    await prisma.platformSettings.create({
      data: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        updatedBy: admin.id,
      },
    });
  }

  console.log('Platform settings created');

  console.log('\n Creating system config...');

  const systemConfigs = [
    {
      configKey: 'email_provider',
      configValue: 'graph',
      description: 'Email provider: graph, sendgrid, smtp',
    },
    {
      configKey: 'storage_provider',
      configValue: 'local',
      description: 'Storage provider: local, s3, azure',
    },
    {
      configKey: 'feature_flags',
      configValue: {
        enable_ai_search: true,
        enable_chat: false,
        enable_reviews: true,
        enable_analytics: true,
      },
      description: 'Feature flags for the platform',
    },
    {
      configKey: 'rate_limits',
      configValue: {
        api: 100,
        auth: 20,
        upload: 10,
      },
      description: 'Rate limits for different endpoints',
    },
    {
      configKey: 'cache_ttl',
      configValue: 3600,
      description: 'Cache TTL in seconds',
    },
  ];

  for (const config of systemConfigs) {
    await prisma.systemConfig.create({
      data: {
        configKey: config.configKey,
        configValue: config.configValue,
        description: config.description,
        isActive: true,
        updatedBy: admin.id,
      },
    });
  }

  console.log('System config created');
  console.log('\n' + '=' .repeat(60));
  console.log(' DATABASE SEEDING COMPLETED SUCCESSFULLY!');
  console.log('=' .repeat(60));

  console.log('\n FINAL SUMMARY:');
  console.log(`\n USERS:`);
  console.log(`Admin: 1`);
  console.log(`Staff: ${staffMembers.length}`);
  console.log(`Vendors: ${vendors.length}`);
  console.log(`Users: ${users.length}`);
  console.log(`Total: ${allUsers.length} users`);

  console.log(`\n PROPERTIES:`);
  console.log(`Total Properties: ${totalProperties}`);
  console.log(`Per Vendor: ${SEED_CONFIG.PROPERTIES_PER_VENDOR}`);

  console.log(`\n DOCUMENTS:`);
  console.log(`NIN Documents: ${vendors.length}`);
  console.log(`Property Documents: ${Math.min(allProperties.length, 20)}`);

  console.log(`\n ACTIVITY LOGS: 200+`);
  console.log(`\n PLATFORM SETTINGS: ${settingsData.length}`);
  console.log(`\n SYSTEM CONFIG: ${systemConfigs.length}`);

  console.log('\n LOGIN CREDENTIALS:');
  console.log(`   Admin:     admin@property.com / ${SEED_CONFIG.PASSWORD}`);
  console.log(`   Staff 1:   ${staffMembers[0]?.email} / ${SEED_CONFIG.PASSWORD}`);
  console.log(`   Staff 2:   ${staffMembers[1]?.email} / ${SEED_CONFIG.PASSWORD}`);
  console.log(`   Vendor 1:  ${vendors[0]?.email} / ${SEED_CONFIG.PASSWORD}`);
  console.log(`   User 1:    ${users[0]?.email} / ${SEED_CONFIG.PASSWORD}`);

  console.log('\n' + '=' .repeat(60));
}



main()
  .catch((e) => {
    console.error('\n Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });