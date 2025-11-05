import { PrismaClient, Role, HealthStatus, Priority, TaskStatus, InventoryType, FinancialTransactionType } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

interface Company {
  name: string;
  location: string;
  emailDomain: string;
}

interface UserData {
  email: string;
  fullName: string;
  password: string;
  companyName: string;
  location: string;
  role: Role;
  isVerified: boolean;
  lastLogin: Date;
}

interface LivestockData {
  tagId: string;
  type: string;
  breed: string;
  birthDate: Date;
  healthStatus: HealthStatus;
  weight: number;
  gender: string;
  livestockSource: string;
  livestockPurpose: string;
  addedById: string;
}

interface TaskData {
  name: string;
  description: string;
  priority: Priority;
  dueDate: Date;
  status: TaskStatus;
  assignedToId: string;
  assignedById: string;
  livestockId: string | null;
}

interface VaccinationData {
  livestockId: string;
  dateofVaccination: Date;
  vaccineType: string;
  dosage: number;
  administeredBy: string;
  nextDueDate: Date;
  recordedById: string;
}

interface SicknessData {
  livestockId: string;
  dateOfObservation: Date;
  observedSymptoms: string;
  suspectedCause: string;
  notes: string;
  recordedById: string;
}

interface TreatmentData {
  sicknessId: string;
  livestockId: string;
  dateOfTreatment: Date;
  treatmentType: string;
  dosage: number;
  cause: string;
  administeredBy: string;
  nextDueDate: Date;
  recordedById: string;
}

interface InventoryData {
  type: InventoryType;
  name: string;
  currentQuantity: number;
  unit: string;
  purchasePrice: number;
  reorderPoint: number;
  supplier: string;
  notes: string;
  mediaUrls: string[];
}

interface FinancialTransactionData {
  type: FinancialTransactionType;
  referenceNumber: string;
  title: string;
  amount: number;
  paymentMethod: string;
  date: Date;
  description: string;
  partyName: string;
  mediaUrls: string[];
  recordedById: string;
}

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data
  // console.log('🗑️ Clearing existing data...');
  // await prisma.taskObservation.deleteMany();
  // await prisma.task.deleteMany();
  // await prisma.vaccination.deleteMany();
  // await prisma.treatment.deleteMany();
  // await prisma.sickness.deleteMany();
  // await prisma.offtakeRecord.deleteMany();
  // await prisma.livestock.deleteMany();
  // await prisma.inventoryRecord.deleteMany();
  // await prisma.inventory.deleteMany();
  // await prisma.financialTransaction.deleteMany();
  // await prisma.user.deleteMany();

  console.log('👥 Creating users...');

  // Create multiple companies
  const companies: Company[] = [
    {
      name: 'Green Valley Farm',
      location: 'Lagos, Nigeria',
      emailDomain: 'greenvalley'
    },
    {
      name: 'Sunrise Ranch', 
      location: 'Abuja, Nigeria',
      emailDomain: 'sunriseranch'
    },
    {
      name: 'Mountain View Farm',
      location: 'Port Harcourt, Nigeria',
      emailDomain: 'mountainview'
    }
  ];

  const createdUsers: any[] = [];

  for (const company of companies) {
    // Create company admin
    const adminPassword: string = await hash('password123');
    const adminData: UserData = {
      email: `admin@${company.emailDomain}.com`,
      fullName: `${company.name} Owner`,
      password: adminPassword,
      companyName: company.name,
      location: company.location,
      role: 'ADMIN' as Role,
      isVerified: true,
      lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    };

    const admin = await prisma.user.create({
      data: adminData
    });
    createdUsers.push(admin);

    // Create farm keeper for this company
    const farmKeeperPassword: string = await hash('password123');
    const farmKeeperData: UserData = {
      email: `farmkeeper@${company.emailDomain}.com`,
      fullName: `${company.name} Farm Keeper`,
      password: farmKeeperPassword,
      companyName: company.name,
      location: company.location,
      role: 'FARM_KEEPER' as Role,
      isVerified: true,
      lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    };

    const farmKeeper = await prisma.user.create({
      data: farmKeeperData
    });
    createdUsers.push(farmKeeper);

    // Create coworker for this company
    const coworkerPassword: string = await hash('password123');
    const coworkerData: UserData = {
      email: `coworker@${company.emailDomain}.com`,
      fullName: `${company.name} Coworker`,
      password: coworkerPassword,
      companyName: company.name,
      location: company.location,
      role: 'COWORKER' as Role,
      isVerified: true,
      lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    };

    const coworker = await prisma.user.create({
      data: coworkerData
    });
    createdUsers.push(coworker);
  }

  // Create vets
  const vetPassword: string = await hash('password123');
  const vet1Data: UserData = {
    email: 'vet.drbrown@animalclinic.com',
    fullName: 'Dr. Sarah Brown',
    password: vetPassword,
    companyName: 'Animal Clinic Ltd',
    location: 'Lagos, Nigeria',
    role: 'VET' as Role,
    isVerified: true,
    lastLogin: new Date()
  };

  const vet1 = await prisma.user.create({
    data: vet1Data
  });
  createdUsers.push(vet1);

  const vet2Data: UserData = {
    email: 'vet.drjohnson@vetcare.com',
    fullName: 'Dr. Michael Johnson',
    password: vetPassword,
    companyName: 'Vet Care Services',
    location: 'Abuja, Nigeria',
    role: 'VET' as Role,
    isVerified: true,
    lastLogin: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  };

  const vet2 = await prisma.user.create({
    data: vet2Data
  });
  createdUsers.push(vet2);

  console.log('🐄 Creating livestock...');

  const livestockTypes: string[] = ['Cattle', 'Goat', 'Sheep', 'Pig', 'Chicken'];
  const breeds: { [key: string]: string[] } = {
    Cattle: ['Angus', 'Hereford', 'Holstein', 'Jersey'],
    Goat: ['Boer', 'Nubian', 'Saanen', 'Alpine'],
    Sheep: ['Dorper', 'Merino', 'Suffolk', 'Dorset'],
    Pig: ['Duroc', 'Hampshire', 'Yorkshire', 'Berkshire'],
    Chicken: ['Rhode Island Red', 'Leghorn', 'Plymouth Rock', 'Sussex']
  };

  const healthStatuses: HealthStatus[] = ['HEALTHY', 'SICK', 'IN_TREATMENT', 'RECOVERING', 'CRITICAL'];
  const createdLivestock: any[] = [];

  for (const company of companies) {
    const companyAdmin = createdUsers.find(u => u.companyName === company.name && u.role === 'ADMIN');
    if (!companyAdmin) continue;
    
    for (let i = 1; i <= 20; i++) {
      const type: string = livestockTypes[Math.floor(Math.random() * livestockTypes.length)];
      const breed: string = breeds[type][Math.floor(Math.random() * breeds[type].length)];
      const healthStatus: HealthStatus = healthStatuses[Math.floor(Math.random() * healthStatuses.length)];
      
      const livestockData: LivestockData = {
        tagId: `${company.name.substring(0, 3).toUpperCase()}-${String(i).padStart(3, '0')}`,
        type,
        breed,
        birthDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000 * 3),
        healthStatus,
        weight: 50 + Math.random() * 200,
        gender: Math.random() > 0.5 ? 'Male' : 'Female',
        livestockSource: ['Purchase', 'Birth', 'Transfer'][Math.floor(Math.random() * 3)],
        livestockPurpose: ['Meat', 'Milk', 'Breeding', 'Eggs'][Math.floor(Math.random() * 4)],
        addedById: companyAdmin.id
      };
      
      const livestock = await prisma.livestock.create({
        data: livestockData
      });
      createdLivestock.push(livestock);
    }
  }

  console.log('💉 Creating vaccinations...');

  const vaccineTypes: string[] = ['Rabies', 'Parvovirus', 'Distemper', 'Leptospirosis', 'Brucellosis', 'Anthrax'];
  
  for (const livestock of createdLivestock.slice(0, 30)) {
    const companyAdmin = createdUsers.find(admin => admin.id === livestock.addedById);
    const recordedBy = createdUsers.find(u => u.role === 'FARM_KEEPER' && u.companyName === companyAdmin?.companyName);
    if (!recordedBy) continue;
    
    const vaccinationData: VaccinationData = {
      livestockId: livestock.id,
      dateofVaccination: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      vaccineType: vaccineTypes[Math.floor(Math.random() * vaccineTypes.length)],
      dosage: 1 + Math.random() * 4,
      administeredBy: 'Farm Staff',
      nextDueDate: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000),
      recordedById: recordedBy.id
    };

    await prisma.vaccination.create({
      data: vaccinationData
    });
  }

  console.log('🤒 Creating sickness records...');

  const symptoms: string[] = ['Fever', 'Coughing', 'Diarrhea', 'Loss of appetite', 'Lethargy', 'Lameness', 'Respiratory distress'];
  const causes: string[] = ['Bacterial infection', 'Viral infection', 'Parasites', 'Nutritional deficiency', 'Injury', 'Unknown'];

  const sickLivestock = createdLivestock.filter(l => 
    l.healthStatus === 'SICK' || l.healthStatus === 'CRITICAL' || l.healthStatus === 'IN_TREATMENT'
  ).slice(0, 15);

  for (const livestock of sickLivestock) {
    const companyAdmin = createdUsers.find(admin => admin.id === livestock.addedById);
    const recordedBy = createdUsers.find(u => u.role === 'FARM_KEEPER' && u.companyName === companyAdmin?.companyName);
    if (!recordedBy) continue;
    
    const sicknessData: SicknessData = {
      livestockId: livestock.id,
      dateOfObservation: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
      observedSymptoms: symptoms.slice(0, 2 + Math.floor(Math.random() * 3)).join(', '),
      suspectedCause: causes[Math.floor(Math.random() * causes.length)],
      notes: 'Animal showing signs of illness, requires monitoring',
      recordedById: recordedBy.id
    };

    const sickness = await prisma.sickness.create({
      data: sicknessData
    });

    // Create treatment for some sickness records
    if (Math.random() > 0.3) {
      const treatmentData: TreatmentData = {
        sicknessId: sickness.id,
        livestockId: livestock.id,
        dateOfTreatment: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        treatmentType: ['Antibiotics', 'Anti-inflammatory', 'Vitamins', 'Pain relief'][Math.floor(Math.random() * 4)],
        dosage: 0.5 + Math.random() * 3,
        cause: 'Prescribed treatment for observed symptoms',
        administeredBy: 'Veterinarian',
        nextDueDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000),
        recordedById: recordedBy.id
      };

      await prisma.treatment.create({
        data: treatmentData
      });
    }
  }

  console.log('📋 Creating tasks...');

  const taskNames: string[] = [
    'Routine Health Check',
    'Vaccination Schedule', 
    'Feed Distribution',
    'Barn Cleaning',
    'Livestock Monitoring',
    'Medical Treatment',
    'Breeding Program',
    'Weight Measurement',
    'Hoof Trimming',
    'Milking Schedule'
  ];

  const priorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];
  const statuses: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

  for (const company of companies) {
    const companyUsers = createdUsers.filter(u => u.companyName === company.name);
    const companyAdmin = companyUsers.find(u => u.role === 'ADMIN');
    const farmKeeper = companyUsers.find(u => u.role === 'FARM_KEEPER');
    const companyLivestock = createdLivestock.filter(l => l.addedById === companyAdmin?.id);
    
    if (!companyAdmin || !farmKeeper) continue;
    
    for (let i = 0; i < 8; i++) {
      const hasLivestock: boolean = Math.random() > 0.3;
      const livestock = hasLivestock && companyLivestock.length > 0 
        ? companyLivestock[Math.floor(Math.random() * companyLivestock.length)] 
        : null;
      const assignToVet: boolean = Math.random() > 0.5;
      const assignedTo = assignToVet ? (Math.random() > 0.5 ? vet1 : vet2) : farmKeeper;
      
      const taskData: TaskData = {
        name: taskNames[Math.floor(Math.random() * taskNames.length)],
        description: `Task description for ${livestock ? livestock.tagId : 'general farm maintenance'}`,
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        dueDate: new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        assignedToId: assignedTo.id,
        assignedById: companyAdmin.id,
        livestockId: livestock?.id || null
      };

      const task = await prisma.task.create({
        data: taskData
      });

      // Add observations for some tasks
      if (Math.random() > 0.6) {
        await prisma.taskObservation.create({
          data: {
            note: `Observation note for task ${task.name}. Work is in progress.`,
            mediaUrls: [],
            taskId: task.id,
            reportedById: assignedTo.id,
            reportedAt: new Date()
          }
        });
      }
    }
  }

  console.log('📦 Creating inventory...');

  const feedItems: string[] = ['Corn Feed', 'Hay', 'Soybean Meal', 'Mineral Supplements'];
  const medicineItems: string[] = ['Antibiotics', 'Vaccines', 'Vitamins', 'Dewormer'];

  for (const company of companies) {
    const companyAdmin = createdUsers.find(u => u.companyName === company.name && u.role === 'ADMIN');
    if (!companyAdmin) continue;
    
    // Create feed inventory
    for (const item of feedItems) {
      const inventoryData: InventoryData = {
        type: 'FEED' as InventoryType,
        name: item,
        currentQuantity: 100 + Math.random() * 400,
        unit: 'kg',
        purchasePrice: 10 + Math.random() * 40,
        reorderPoint: 50,
        supplier: 'Farm Supplies Ltd',
        notes: `${item} for livestock feeding`,
        mediaUrls: []
      };

      await prisma.inventory.create({
        data: inventoryData
      });
    }

    // Create medicine inventory
    for (const item of medicineItems) {
      const inventoryData: InventoryData = {
        type: 'MEDICINE' as InventoryType,
        name: item,
        currentQuantity: 20 + Math.random() * 80,
        unit: 'units',
        purchasePrice: 5 + Math.random() * 25,
        reorderPoint: 10,
        supplier: 'Medical Supplies Co',
        notes: `${item} for veterinary use`,
        mediaUrls: []
      };

      await prisma.inventory.create({
        data: inventoryData
      });
    }
  }

  console.log('💰 Creating financial transactions...');

  const incomeSources: string[] = ['Livestock Sales', 'Milk Production', 'Egg Sales', 'Breeding Services'];
  const expenseCategories: string[] = ['Feed Purchase', 'Medical Supplies', 'Equipment Maintenance', 'Staff Salaries'];
  const paymentMethods: string[] = ['Cash', 'Bank Transfer', 'Mobile Money'];

  for (const company of companies) {
    const companyAdmin = createdUsers.find(u => u.companyName === company.name && u.role === 'ADMIN');
    if (!companyAdmin) continue;
    
    for (let i = 0; i < 10; i++) {
      const isIncome: boolean = Math.random() > 0.4;
      const transactionData: FinancialTransactionData = {
        type: isIncome ? 'INCOME' as FinancialTransactionType : 'EXPENSE' as FinancialTransactionType,
        referenceNumber: `REF-${company.name.substring(0, 3).toUpperCase()}-${String(i).padStart(4, '0')}`,
        title: isIncome 
          ? incomeSources[Math.floor(Math.random() * incomeSources.length)]
          : expenseCategories[Math.floor(Math.random() * expenseCategories.length)],
        amount: isIncome ? 500 + Math.random() * 2000 : 50 + Math.random() * 500,
        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        description: `${isIncome ? 'Revenue from' : 'Payment for'} ${isIncome ? 'farm products' : 'farm operations'}`,
        partyName: isIncome ? 'Farm Products Buyer' : 'Farm Supplies Vendor',
        mediaUrls: [],
        recordedById: companyAdmin.id
      };

      await prisma.financialTransaction.create({
        data: transactionData
      });
    }
  }

  console.log('✅ Seed completed successfully!');
  // console.log('\n📊 Seed Summary:');
  // console.log(`   Users: ${createdUsers.length}`);
  // console.log(`   Livestock: ${createdLivestock.length}`);
  // console.log(`   Tasks: ~24 (8 per company)`);
  // console.log(`   Vaccinations: 30`);
  // console.log(`   Sickness Records: ~15`);
  // console.log(`   Inventory Items: ~21 (7 per company)`);
  // console.log(`   Financial Transactions: 30 (10 per company)`);

  console.log('\n🔑 Test Credentials:');
  console.log('   All passwords: "password123"');
  // console.log('\n   Company Admins:');
  // console.log('     - admin@greenvalley.com (Green Valley Farm)');
  // console.log('     - admin@sunriseranch.com (Sunrise Ranch)');
  // console.log('     - admin@mountainview.com (Mountain View Farm)');
  // console.log('\n   Vets:');
  // console.log('     - vet.drbrown@animalclinic.com');
  // console.log('     - vet.drjohnson@vetcare.com');
  // console.log('\n   Farm Keepers:');
  // console.log('     - farmkeeper@greenvalley.com');
  // console.log('     - farmkeeper@sunriseranch.com');
  // console.log('     - farmkeeper@mountainview.com');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });