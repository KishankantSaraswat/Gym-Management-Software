import bcrypt from 'bcrypt';
import { sequelize } from '../database/db.js';
import {
  GymMaster,
  GymBranchMaster,
  GymUser,
  GymBranchUser,
  UserGroupMaster,
  GymUserGroup,
  UserPermissionMaster,
  GymPermission,
  SubscriptionPlan
} from '../models/multi_tenant_schema.js';
import { User, Gym, Plan, UserPlan } from '../models/schema.js';

export async function seedTestTenants() {
  console.log('================================================================');
  console.log('🌱 STARTING TEST DATA SEEDING (4 GYMS, 10 BRANCHES, 50+ USERS)');
  console.log('================================================================');

  const hashedPassword = await bcrypt.hash('TestPass@123', 10);

  // 1. Fetch Subscription Plans and User Groups
  const plans = await SubscriptionPlan.findAll();
  const planMap = {};
  plans.forEach(p => { planMap[p.planCode] = p.id; });

  const groups = await UserGroupMaster.findAll();
  const groupMap = {};
  groups.forEach(g => { groupMap[g.groupCode] = g.id; });

  const permissions = await UserPermissionMaster.findAll();

  // 2. Define 4 Test Gyms
  const gymDefinitions = [
    {
      code: 'GYM-TEST-001',
      name: 'FitZone Fitness',
      legalName: 'FitZone Fitness Pvt Ltd',
      planId: planMap['PRO'] || 3,
      email: 'contact@fitzone-test.com',
      phone: '+919870000001',
      branches: [
        { code: 'BR-FZ-GGN', name: 'FitZone Gurgaon', city: 'Gurgaon', address: 'Sector 29, Gurgaon', capacity: 150 },
        { code: 'BR-FZ-DEL', name: 'FitZone Delhi', city: 'Delhi', address: 'Connaught Place, New Delhi', capacity: 120 },
        { code: 'BR-FZ-NOI', name: 'FitZone Noida', city: 'Noida', address: 'Sector 18, Noida', capacity: 100 }
      ]
    },
    {
      code: 'GYM-TEST-002',
      name: 'IronCore Gym',
      legalName: 'IronCore Enterprises',
      planId: planMap['BASIC'] || 2,
      email: 'contact@ironcore-test.com',
      phone: '+919870000002',
      branches: [
        { code: 'BR-IC-GGN', name: 'IronCore Gurgaon', city: 'Gurgaon', address: 'Golf Course Road, Gurgaon', capacity: 80 },
        { code: 'BR-IC-FBD', name: 'IronCore Faridabad', city: 'Faridabad', address: 'Sector 15, Faridabad', capacity: 70 }
      ]
    },
    {
      code: 'GYM-TEST-003',
      name: 'PowerHouse Fitness',
      legalName: 'PowerHouse Global Health',
      planId: planMap['ENTERPRISE'] || 4,
      email: 'contact@powerhouse-test.com',
      phone: '+919870000003',
      branches: [
        { code: 'BR-PH-DEL', name: 'PowerHouse Delhi', city: 'Delhi', address: 'South Extension, New Delhi', capacity: 200 },
        { code: 'BR-PH-NOI', name: 'PowerHouse Noida', city: 'Noida', address: 'Sector 62, Noida', capacity: 180 },
        { code: 'BR-PH-GZB', name: 'PowerHouse Ghaziabad', city: 'Ghaziabad', address: 'Raj Nagar, Ghaziabad', capacity: 140 }
      ]
    },
    {
      code: 'GYM-TEST-004',
      name: 'EliteFit Club',
      legalName: 'EliteFit Luxury Gyms',
      planId: planMap['BASIC'] || 2,
      email: 'contact@elitefit-test.com',
      phone: '+919870000004',
      branches: [
        { code: 'BR-EF-GGN', name: 'EliteFit Gurgaon', city: 'Gurgaon', address: 'Cyber City, Gurgaon', capacity: 90 },
        { code: 'BR-EF-DEL', name: 'EliteFit Delhi', city: 'Delhi', address: 'Saket, New Delhi', capacity: 85 }
      ]
    }
  ];

  const createdGyms = {};
  const createdBranches = {};

  for (const gDef of gymDefinitions) {
    // Upsert or Find GymMaster
    let [gym] = await GymMaster.findOrCreate({
      where: { gymCode: gDef.code },
      defaults: {
        gymCode: gDef.code,
        gymName: gDef.name,
        legalName: gDef.legalName,
        email: gDef.email,
        phone: gDef.phone,
        subscriptionPlanId: gDef.planId,
        status: 'active'
      }
    });
    createdGyms[gDef.code] = gym;

    // Legacy Gym table entry for backward compatibility
    let [legacyGym] = await Gym.findOrCreate({
      where: { name: gDef.name },
      defaults: {
        name: gDef.name,
        address: gDef.branches[0].address,
        latitude: 28.4595,
        longitude: 77.0266,
        capacity: 100,
        openTime: '06:00',
        closeTime: '22:00',
        contactEmail: gDef.email,
        phone: gDef.phone,
        ownerId: 6, // default to existing owner until specific owner is created
        status: 'open',
        isVerified: true
      }
    });

    // Create Branches
    for (const bDef of gDef.branches) {
      let [branch] = await GymBranchMaster.findOrCreate({
        where: { branchCode: bDef.code },
        defaults: {
          gymId: gym.id,
          branchCode: bDef.code,
          branchName: bDef.name,
          address: bDef.address,
          city: bDef.city,
          phone: gDef.phone,
          contactEmail: gDef.email,
          capacity: bDef.capacity,
          openTime: '06:00',
          closeTime: '22:00',
          status: 'active'
        }
      });
      createdBranches[bDef.code] = branch;
    }

    // Configure Gym Permissions based on Subscription
    // For BASIC plans (IronCore, EliteFit): Disable AI Coach to test feature gating
    const isBasic = (gDef.planId === (planMap['BASIC'] || 2));
    for (const perm of permissions) {
      let isEnabled = true;
      if (isBasic && (perm.permissionCode === 'AI_COACH_USE' || perm.permissionCode === 'AI_ANALYTICS_VIEW')) {
        isEnabled = false;
      }
      await GymPermission.findOrCreate({
        where: { gymId: gym.id, permissionId: perm.id },
        defaults: {
          gymId: gym.id,
          permissionId: perm.id,
          isEnabled
        }
      });
    }

    // Seed sample membership plans
    await Plan.findOrCreate({
      where: { gymId: legacyGym.id, name: `${gDef.name} Monthly Pass` },
      defaults: {
        gymId: legacyGym.id,
        name: `${gDef.name} Monthly Pass`,
        validity: 30,
        price: 2500,
        discountPercent: 5,
        duration: 30,
        features: 'Gym Access, Cardio, Locker',
        planType: 'Monthly',
        isActive: true
      }
    });

    await Plan.findOrCreate({
      where: { gymId: legacyGym.id, name: `${gDef.name} Annual VIP` },
      defaults: {
        gymId: legacyGym.id,
        name: `${gDef.name} Annual VIP`,
        validity: 365,
        price: 22000,
        discountPercent: 15,
        duration: 365,
        features: 'All Access, Trainer, Spa, AI Tracking',
        planType: 'Annual',
        isTrainerIncluded: true,
        isActive: true
      }
    });
  }

  console.log(`✓ 4 Gyms & ${Object.keys(createdBranches).length} Branches verified/created.`);

  // 3. User Seed Templates (12 users per gym)
  const roleTemplates = [
    { prefix: 'owner', name: 'Owner', role: 'GymOwner', group: 'GYM_OWNER', branchIndex: 0, allBranches: true },
    { prefix: 'admin', name: 'Admin', role: 'GymOwner', group: 'GYM_ADMIN', branchIndex: 0, allBranches: true },
    { prefix: 'manager', name: 'Manager', role: 'User', group: 'BRANCH_MANAGER', branchIndex: 0, allBranches: false },
    { prefix: 'trainer1', name: 'Trainer 1', role: 'User', group: 'TRAINER', branchIndex: 0, multiBranch: true },
    { prefix: 'trainer2', name: 'Trainer 2', role: 'User', group: 'TRAINER', branchIndex: 1, allBranches: false },
    { prefix: 'reception1', name: 'Receptionist 1', role: 'User', group: 'RECEPTIONIST', branchIndex: 0, allBranches: false },
    { prefix: 'reception2', name: 'Receptionist 2', role: 'User', group: 'RECEPTIONIST', branchIndex: 1, allBranches: false },
    { prefix: 'accountant', name: 'Accountant', role: 'User', group: 'ACCOUNTANT', branchIndex: 0, allBranches: true },
    { prefix: 'nutritionist', name: 'Nutritionist', role: 'User', group: 'NUTRITIONIST', branchIndex: 0, allBranches: false },
    { prefix: 'member1', name: 'Member 1', role: 'User', group: 'MEMBER', branchIndex: 0, allBranches: false },
    { prefix: 'member2', name: 'Member 2', role: 'User', group: 'MEMBER', branchIndex: 1, allBranches: false },
    { prefix: 'member3', name: 'Member 3', role: 'User', group: 'MEMBER', branchIndex: 0, allBranches: false }
  ];

  let userCounter = 100;
  const createdUsers = {};

  for (const gDef of gymDefinitions) {
    const gym = createdGyms[gDef.code];
    const gymBranchCodes = gDef.branches.map(b => b.code);

    const gymPrefixMap = {
      'GYM-TEST-001': 'fitzone',
      'GYM-TEST-002': 'ironcore',
      'GYM-TEST-003': 'powerhouse',
      'GYM-TEST-004': 'elitefit'
    };

    for (const rTpl of roleTemplates) {
      userCounter++;
      const userTag = (gymPrefixMap[gDef.code] || 'gym') + '_' + rTpl.prefix;
      const email = `${userTag}@gymhood-test.com`;
      const phone = `+91987000${String(userCounter).padStart(4, '0')}`;
      const fullName = `${gDef.name} ${rTpl.name}`;

      let [user] = await User.findOrCreate({
        where: { email },
        defaults: {
          name: fullName,
          email,
          phone,
          password: hashedPassword,
          role: rTpl.role,
          accountVerified: true,
          isPwdAuth: true
        }
      });
      createdUsers[userTag] = user;

      // Update gym owner if this is the owner
      if (rTpl.group === 'GYM_OWNER') {
        gym.ownerId = user.id;
        await gym.save();
      }

      // Create GymUser membership
      let [gymUser] = await GymUser.findOrCreate({
        where: { userId: user.id, gymId: gym.id },
        defaults: {
          userId: user.id,
          gymId: gym.id,
          userType: rTpl.group,
          status: 'active'
        }
      });

      // Assign Role in gym_user_group
      const groupId = groupMap[rTpl.group];
      if (groupId) {
        await GymUserGroup.findOrCreate({
          where: { gymUserId: gymUser.id, groupId },
          defaults: {
            gymUserId: gymUser.id,
            groupId,
            isPrimary: true,
            isActive: true
          }
        });
      }

      // Assign Branch access in gym_branch_user
      if (rTpl.allBranches) {
        for (const bCode of gymBranchCodes) {
          const b = createdBranches[bCode];
          await GymBranchUser.findOrCreate({
            where: { gymId: gym.id, branchId: b.id, gymUserId: gymUser.id },
            defaults: { gymId: gym.id, branchId: b.id, gymUserId: gymUser.id, isActive: true }
          });
        }
      } else if (rTpl.multiBranch && gymBranchCodes.length >= 2) {
        // First 2 branches
        for (let i = 0; i < 2; i++) {
          const b = createdBranches[gymBranchCodes[i]];
          await GymBranchUser.findOrCreate({
            where: { gymId: gym.id, branchId: b.id, gymUserId: gymUser.id },
            defaults: { gymId: gym.id, branchId: b.id, gymUserId: gymUser.id, isActive: true }
          });
        }
      } else {
        const branchIndex = Math.min(rTpl.branchIndex, gymBranchCodes.length - 1);
        const b = createdBranches[gymBranchCodes[branchIndex]];
        await GymBranchUser.findOrCreate({
          where: { gymId: gym.id, branchId: b.id, gymUserId: gymUser.id },
          defaults: { gymId: gym.id, branchId: b.id, gymUserId: gymUser.id, isActive: true }
        });
      }
    }
  }

  // 4. Create Multi-Role User (FitZone: TRAINER + BRANCH_MANAGER)
  userCounter++;
  const multiRoleEmail = 'fitzone.multirole@gymhood-test.com';
  let [multiRoleUser] = await User.findOrCreate({
    where: { email: multiRoleEmail },
    defaults: {
      name: 'FitZone Multi-Role Specialist',
      email: multiRoleEmail,
      phone: `+91987000${String(userCounter).padStart(4, '0')}`,
      password: hashedPassword,
      role: 'User',
      accountVerified: true,
      isPwdAuth: true
    }
  });

  const fitZoneGym = createdGyms['GYM-TEST-001'];
  let [fitZoneMultiGymUser] = await GymUser.findOrCreate({
    where: { userId: multiRoleUser.id, gymId: fitZoneGym.id },
    defaults: { userId: multiRoleUser.id, gymId: fitZoneGym.id, userType: 'STAFF', status: 'active' }
  });

  await GymUserGroup.findOrCreate({
    where: { gymUserId: fitZoneMultiGymUser.id, groupId: groupMap['TRAINER'] },
    defaults: { gymUserId: fitZoneMultiGymUser.id, groupId: groupMap['TRAINER'], isPrimary: true, isActive: true }
  });
  await GymUserGroup.findOrCreate({
    where: { gymUserId: fitZoneMultiGymUser.id, groupId: groupMap['BRANCH_MANAGER'] },
    defaults: { gymUserId: fitZoneMultiGymUser.id, groupId: groupMap['BRANCH_MANAGER'], isPrimary: false, isActive: true }
  });

  // Assign Gurgaon branch
  const ggnBranch = createdBranches['BR-FZ-GGN'];
  await GymBranchUser.findOrCreate({
    where: { gymId: fitZoneGym.id, branchId: ggnBranch.id, gymUserId: fitZoneMultiGymUser.id },
    defaults: { gymId: fitZoneGym.id, branchId: ggnBranch.id, gymUserId: fitZoneMultiGymUser.id, isActive: true }
  });

  // 5. Create Multi-Gym Users (Crucial Requirement: 1 User, Multiple Gyms)
  const multiGymDefinitions = [
    {
      name: 'Rahul Sharma',
      email: 'rahul.sharma@gymhood-test.com',
      phone: '+919811100001',
      gyms: [
        { gymCode: 'GYM-TEST-001', branchCode: 'BR-FZ-GGN', group: 'MEMBER' },
        { gymCode: 'GYM-TEST-002', branchCode: 'BR-IC-GGN', group: 'MEMBER' }
      ]
    },
    {
      name: 'Amit Verma',
      email: 'amit.verma@gymhood-test.com',
      phone: '+919811100002',
      gyms: [
        { gymCode: 'GYM-TEST-003', branchCode: 'BR-PH-DEL', group: 'MEMBER' },
        { gymCode: 'GYM-TEST-004', branchCode: 'BR-EF-GGN', group: 'MEMBER' }
      ]
    },
    {
      name: 'Priya Singh',
      email: 'priya.singh@gymhood-test.com',
      phone: '+919811100003',
      gyms: [
        { gymCode: 'GYM-TEST-001', branchCode: 'BR-FZ-DEL', group: 'TRAINER' },
        { gymCode: 'GYM-TEST-003', branchCode: 'BR-PH-NOI', group: 'TRAINER' }
      ]
    }
  ];

  for (const mDef of multiGymDefinitions) {
    let [mUser] = await User.findOrCreate({
      where: { email: mDef.email },
      defaults: {
        name: mDef.name,
        email: mDef.email,
        phone: mDef.phone,
        password: hashedPassword,
        role: 'User',
        accountVerified: true,
        isPwdAuth: true
      }
    });

    for (const gEntry of mDef.gyms) {
      const g = createdGyms[gEntry.gymCode];
      const b = createdBranches[gEntry.branchCode];

      let [gUser] = await GymUser.findOrCreate({
        where: { userId: mUser.id, gymId: g.id },
        defaults: {
          userId: mUser.id,
          gymId: g.id,
          userType: gEntry.group,
          status: 'active'
        }
      });

      const groupId = groupMap[gEntry.group];
      if (groupId) {
        await GymUserGroup.findOrCreate({
          where: { gymUserId: gUser.id, groupId },
          defaults: {
            gymUserId: gUser.id,
            groupId,
            isPrimary: true,
            isActive: true
          }
        });
      }

      await GymBranchUser.findOrCreate({
        where: { gymId: g.id, branchId: b.id, gymUserId: gUser.id },
        defaults: {
          gymId: g.id,
          branchId: b.id,
          gymUserId: gUser.id,
          isActive: true
        }
      });
    }
  }

  console.log('✓ Multi-gym users (Rahul Sharma, Amit Verma, Priya Singh) created.');
  console.log('================================================================');
  console.log('🎉 SEEDING COMPLETE: 4 TEST GYMS, 10 BRANCHES, 52 USERS READY!');
  console.log('================================================================');
}

// Run if called directly
if (process.argv[1]?.endsWith('seed_test_tenants.js')) {
  seedTestTenants().then(() => process.exit(0)).catch(err => {
    console.error('Seeding error:', err);
    process.exit(1);
  });
}
