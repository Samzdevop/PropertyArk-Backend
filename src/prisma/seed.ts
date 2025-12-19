import { PrismaClient, Role, HealthStatus, Priority, TaskStatus, InventoryType, FinancialTransactionType, DiagnosisSeverity, DiagnosisPrognosis, Frequency, AdministrationRoutine, NotificationType, NotificationStatus, VisitType, Offtake } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

interface CompanyData {
  name: string;
  location: string;
  phone: string;
}

interface UserData {
  email: string;
  fullName: string;
  password: string;
  location: string;
  phone: string;
  role: Role;
  isVerified: boolean;
  lastLogin: Date;
}

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data in correct order to handle foreign key constraints
  // console.log('🗑️ Clearing existing data...');
  await prisma.note.deleteMany();
  await prisma.followUpReminder.deleteMany();
  await prisma.treatmentReminder.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.prescribedTreatment.deleteMany();
  await prisma.diagnosis.deleteMany();
  await prisma.appointmentReminder.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.farmVisit.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.taskObservation.deleteMany();
  await prisma.task.deleteMany();
  await prisma.treatment.deleteMany();
  await prisma.sickness.deleteMany();
  await prisma.vaccination.deleteMany();
  await prisma.offtakeRecord.deleteMany();
  await prisma.livestock.deleteMany();
  await prisma.inventoryRecord.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.financialTransaction.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  console.log('🏢 Creating companies and users...');

  const companiesData: CompanyData[] = [
    {
      name: 'Green Valley Farm',
      location: 'Lagos, Nigeria',
      phone: '+2348012345001'
    },
    {
      name: 'Sunrise Ranch', 
      location: 'Abuja, Nigeria',
      phone: '+2348012345002'
    },
    {
      name: 'Mountain View Farm',
      location: 'Port Harcourt, Nigeria',
      phone: '+2348012345003'
    }
  ];

  const createdCompanies: any[] = [];
  const createdUsers: any[] = [];

  // Create companies and admin users
  for (const companyData of companiesData) {
    // Create company
    const company = await prisma.company.create({
      data: {
        name: companyData.name,
        location: companyData.location,
        phone: companyData.phone,
        isActive: true
      }
    });
    createdCompanies.push(company);

    // Create company admin
    const adminPassword: string = await hash('password123');
    const adminData = {
      email: `admin@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
      fullName: `${company.name} Owner`,
      password: adminPassword,
      companyName: company.name,
      companyId: company.id,
      location: company.location,
      phone: company.phone,
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
    const farmKeeperData = {
      email: `farmkeeper@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
      fullName: `${company.name} Farm Keeper`,
      password: farmKeeperPassword,
      companyName: company.name,
      companyId: company.id,
      location: company.location,
      phone: `+2348012345${String(createdUsers.length + 100).padStart(3, '0')}`,
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
    const coworkerData = {
      email: `coworker@${company.name.toLowerCase().replace(/\s+/g, '')}.com`,
      fullName: `${company.name} Coworker`,
      password: coworkerPassword,
      companyName: company.name,
      companyId: company.id,
      location: company.location,
      phone: `+2348012345${String(createdUsers.length + 200).padStart(3, '0')}`,
      role: 'COWORKER' as Role,
      isVerified: true,
      lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000)
    };

    const coworker = await prisma.user.create({
      data: coworkerData
    });
    createdUsers.push(coworker);
  }

  // Create vets (they don't belong to specific companies)
  const vetPassword: string = await hash('password123');
  const vet1 = await prisma.user.create({
    data: {
      email: 'vet.drbrown@animalclinic.com',
      fullName: 'Dr. Sarah Brown',
      password: vetPassword,
      companyName: 'Animal Clinic Ltd',
      location: 'Lagos, Nigeria',
      phone: '+2348012345004',
      role: 'VET' as Role,
      isVerified: true,
      lastLogin: new Date()
    }
  });
  createdUsers.push(vet1);

  const vet2 = await prisma.user.create({
    data: {
      email: 'vet.drjohnson@vetcare.com',
      fullName: 'Dr. Michael Johnson',
      password: vetPassword,
      companyName: 'Vet Care Services',
      location: 'Abuja, Nigeria',
      phone: '+2348012345005',
      role: 'VET' as Role,
      isVerified: true,
      lastLogin: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }
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

  for (const company of createdCompanies) {
    const companyAdmin = createdUsers.find(u => u.companyId === company.id && u.role === 'ADMIN');
    if (!companyAdmin) continue;
    
    for (let i = 1; i <= 20; i++) {
      const type: string = livestockTypes[Math.floor(Math.random() * livestockTypes.length)];
      const breed: string = breeds[type][Math.floor(Math.random() * breeds[type].length)];
      const healthStatus: HealthStatus = healthStatuses[Math.floor(Math.random() * healthStatuses.length)];
      
      const livestockData = {
        tagId: `${company.name.substring(0, 3).toUpperCase()}-${String(i).padStart(3, '0')}`,
        type,
        breed,
        birthDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000 * 3),
        healthStatus,
        weight: 50 + Math.random() * 200,
        gender: Math.random() > 0.5 ? 'Male' : 'Female',
        livestockSource: ['Purchase', 'Birth', 'Transfer'][Math.floor(Math.random() * 3)],
        livestockPurpose: ['Meat', 'Milk', 'Breeding', 'Eggs'][Math.floor(Math.random() * 4)],
        companyId: company.id,
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
    const company = createdCompanies.find(c => c.id === livestock.companyId);
    const recordedBy = createdUsers.find(u => 
      u.companyId === livestock.companyId && 
      u.role === 'FARM_KEEPER'
    );
    if (!recordedBy) continue;
    
    const vaccinationData = {
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

  const createdSickness: any[] = [];

  for (const livestock of sickLivestock) {
    const recordedBy = createdUsers.find(u => 
      u.companyId === livestock.companyId && 
      u.role === 'FARM_KEEPER'
    );
    if (!recordedBy) continue;
    
    const sicknessData = {
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
    createdSickness.push(sickness);

    // Create treatment for some sickness records
    if (Math.random() > 0.3) {
      const treatmentData = {
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

  console.log('🩺 Creating diagnoses...');

  const diagnoses: string[] = ['Bacterial Pneumonia', 'Parasitic Infection', 'Nutritional Deficiency', 'Viral Infection', 'Metabolic Disorder'];
  
  for (const livestock of sickLivestock.slice(0, 10)) {
    const diagnosisData = {
      livestockId: livestock.id,
      diagnosis: diagnoses[Math.floor(Math.random() * diagnoses.length)],
      labTests: ['Blood Test', 'Fecal Exam', 'Culture'][Math.floor(Math.random() * 3)],
      severity: ['MILD', 'MODERATE', 'SEVERE', 'CRITICAL'][Math.floor(Math.random() * 4)] as DiagnosisSeverity,
      prognosis: ['GOOD', 'FAIR', 'GUARDED', 'POOR'][Math.floor(Math.random() * 4)] as DiagnosisPrognosis,
      observations: 'Diagnosis based on clinical signs and lab results',
      date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      recordedById: vet1.id
    };

    await prisma.diagnosis.create({
      data: diagnosisData
    });
  }

  console.log('💊 Creating prescribed treatments...');

  for (const livestock of sickLivestock.slice(0, 8)) {
    const prescribedTreatmentData = {
      livestockId: livestock.id,
      treatmentType: 'Medication',
      medicationName: ['Amoxicillin', 'Ivermectin', 'Vitamin Complex', 'Anti-inflammatory'][Math.floor(Math.random() * 4)],
      dosage: '2ml per kg',
      frequency: ['DAILY', 'TWICE_DAILY', 'WEEKLY'][Math.floor(Math.random() * 3)] as Frequency,
      routine: ['ORAL', 'INTRAMUSCULAR', 'TOPICAL'][Math.floor(Math.random() * 3)] as AdministrationRoutine,
      additionalNotes: 'Administer with food',
      startDate: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000),
      isActive: true,
      recordedById: vet1.id
    };

    await prisma.prescribedTreatment.create({
      data: prescribedTreatmentData
    });
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

  const createdTasks: any[] = [];

  for (const company of createdCompanies) {
    const companyUsers = createdUsers.filter(u => u.companyId === company.id);
    const companyAdmin = companyUsers.find(u => u.role === 'ADMIN');
    const farmKeeper = companyUsers.find(u => u.role === 'FARM_KEEPER');
    const companyLivestock = createdLivestock.filter(l => l.companyId === company.id);
    
    if (!companyAdmin || !farmKeeper) continue;
    
    for (let i = 0; i < 8; i++) {
      const hasLivestock: boolean = Math.random() > 0.3;
      const livestock = hasLivestock && companyLivestock.length > 0 
        ? companyLivestock[Math.floor(Math.random() * companyLivestock.length)] 
        : null;
      const assignToVet: boolean = Math.random() > 0.5;
      const assignedTo = assignToVet ? (Math.random() > 0.5 ? vet1 : vet2) : farmKeeper;
      
      const taskData = {
        name: taskNames[Math.floor(Math.random() * taskNames.length)],
        description: `Task description for ${livestock ? livestock.tagId : 'general farm maintenance'}`,
        priority: priorities[Math.floor(Math.random() * priorities.length)],
        companyId: company.id,
        dueDate: new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000),
        status: statuses[Math.floor(Math.random() * statuses.length)],
        assignedToId: assignedTo.id,
        assignedById: companyAdmin.id,
        livestockId: livestock?.id || null
      };

      const task = await prisma.task.create({
        data: taskData
      });
      createdTasks.push(task);

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

  for (const company of createdCompanies) {
    // Create feed inventory
    for (const item of feedItems) {
      const inventoryData = {
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
      const inventoryData = {
        type: 'MEDICINE' as InventoryType,
        name: item,
        currentQuantity: 20 + Math.random() * 80,
        unit: 'units',
        purchasePrice: 5 + Math.random() * 25,
        reorderPoint: 10,
        supplier: 'Medical Supplies Co',
        notes: `${item} for veterinary use`,
        mediaUrls: [],
        companyId: company.id,
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

  for (const company of createdCompanies) {
    const companyAdmin = createdUsers.find(u => u.companyId === company.id && u.role === 'ADMIN');
    if (!companyAdmin) continue;
    
    for (let i = 0; i < 10; i++) {
      const isIncome: boolean = Math.random() > 0.4;
      const transactionData = {
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

  console.log('📤 Creating offtake records...');

  for (const livestock of createdLivestock.slice(0, 10)) {
    const recordedBy = createdUsers.find(u => 
      u.companyId === livestock.companyId && 
      u.role === 'FARM_KEEPER'
    );
    if (!recordedBy) continue;

    const offtakeType = ['SALE', 'DEATH', 'MISSING'][Math.floor(Math.random() * 3)] as Offtake;
    
    const offtakeData: any = {
      livestockId: livestock.id,
      type: offtakeType,
      dateOfEvent: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
      recordedById: recordedBy.id
    };

    if (offtakeType === 'SALE') {
      offtakeData.destination = 'Local Market';
      offtakeData.price = 200 + Math.random() * 800;
    } else if (offtakeType === 'DEATH') {
      offtakeData.causeOfDeath = ['Disease', 'Injury', 'Old Age'][Math.floor(Math.random() * 3)];
    }

    await prisma.offtakeRecord.create({
      data: offtakeData
    });
  }

  console.log('📅 Creating appointments...');

  for (const company of createdCompanies.slice(0, 2)) {
    const vet = createdUsers.find(u => u.role === 'VET');
    const companyLivestock = createdLivestock.filter(l => l.companyId === company.id);
    
    if (!vet || companyLivestock.length === 0) continue;

    const appointmentData = {
      visitType: 'FARM_VISIT' as VisitType,
      title: 'Routine Health Inspection',
      date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      companyId: company.id,
      relatedFarm: company.name,
      relatedAnimal: companyLivestock[0].tagId,
      purpose: 'Regular health check and vaccination',
      setReminder: true,
      notifyFarmStaff: true,
      status: 'SCHEDULED',
      recordedById: vet.id
    };

    await prisma.appointment.create({
      data: appointmentData
    });
  }

  console.log('🏥 Creating farm visits...');

  for (const company of createdCompanies.slice(0, 2)) {
    const vet = createdUsers.find(u => u.role === 'VET');
    
    if (!vet) continue;

    const farmVisitData = {
      companyId: company.id,
      relatedFarm: company.name,
      date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      time: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      reason: 'Routine farm inspection and consultation',
      keyPersonnelMet: 'Farm Manager, Staff',
      animalExamined: 'Multiple livestock checked',
      farmObservation: 'Farm is in good condition, animals appear healthy',
      farmRecommendation: 'Continue current feeding and healthcare regimen',
      mediaUrls: [],
      recordedById: vet.id
    };

    await prisma.farmVisit.create({
      data: farmVisitData
    });
  }

  console.log('📝 Creating notes...');

  const noteFolders: string[] = ['Farm Observations', 'Medical Records', 'Breeding Notes', 'Financial Notes', 'General'];
  
  for (const user of createdUsers.slice(0, 5)) {
    for (let i = 0; i < 3; i++) {
      const noteData = {
        folderName: noteFolders[Math.floor(Math.random() * noteFolders.length)],
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        title: `Note ${i + 1} - ${new Date().toLocaleDateString()}`,
        body: `This is a sample note content for ${user.fullName}. This note contains important information about farm operations and observations.`,
        recordedById: user.id
      };

      await prisma.note.create({
        data: noteData
      });
    }
  }

  console.log('🔔 Creating notifications...');

  for (const user of createdUsers.slice(0, 8)) {
    const notificationData = {
      title: 'Welcome to Agritech System',
      message: 'Your account has been successfully set up and is ready to use.',
      type: 'SYSTEM_ALERT' as NotificationType,
      status: 'UNREAD' as NotificationStatus,
      recipientId: user.id,
      sentAt: new Date()
    };

    await prisma.notification.create({
      data: notificationData
    });
  }

  console.log('✅ Seed completed successfully!');
  
//   console.log(`\n📊 Seed Summary:`);
//   console.log(`   Companies: ${createdCompanies.length}`);
//   console.log(`   Users: ${createdUsers.length}`);
//   console.log(`   Livestock: ${createdLivestock.length}`);
//   console.log(`   Vaccinations: 30`);
//   console.log(`   Sickness Records: ${createdSickness.length}`);
//   console.log(`   Diagnoses: 10`);
//   console.log(`   Prescribed Treatments: 8`);
//   console.log(`   Tasks: ${createdTasks.length}`);
//   console.log(`   Inventory Items: ~24 (8 per company)`);
//   console.log(`   Financial Transactions: 30 (10 per company)`);
//   console.log(`   Offtake Records: 10`);
//   console.log(`   Appointments: 2`);
//   console.log(`   Farm Visits: 2`);
//   console.log(`   Notes: 15`);
//   console.log(`   Notifications: 8`);

//   console.log('\n🔑 Test Credentials:');
//   console.log('   All passwords: "password123"');
//   console.log('\n   Company Admins:');
//   console.log('     - admin@greenvalleyfarm.com (Green Valley Farm)');
//   console.log('     - admin@sunriseranch.com (Sunrise Ranch)');
//   console.log('     - admin@mountainviewfarm.com (Mountain View Farm)');
//   console.log('\n   Vets:');
//   console.log('     - vet.drbrown@animalclinic.com');
//   console.log('     - vet.drjohnson@vetcare.com');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });