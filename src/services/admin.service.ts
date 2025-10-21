import User from '../models/user.model';
import bcrypt from 'bcryptjs';
import logger from '../utils/logger';

export const createAdminUser = async () => {
  try {
    const adminExists = await User.findOne({ email: process.env.ADMIN_EMAIL });
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10);
      
      await User.create({
        name: 'Admin',
        email: process.env.ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });
      
      logger.info('Admin user created successfully');
    }
  } catch (error) {
    logger.error(`Error creating admin user: ${error}`);
  }
};

export const createSampleDoctors = async () => {
  try {
    const doctors = [
      {
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@healthcare.com',
        password: 'Doctor123!',
        role: 'doctor',
        specialization: 'Cardiology',
        isActive: true
      },
      {
        name: 'Dr. Michael Chen',
        email: 'michael.chen@healthcare.com',
        password: 'Doctor123!',
        role: 'doctor',
        specialization: 'Dermatology',
        isActive: true
      },
      {
        name: 'Dr. Emily Rodriguez',
        email: 'emily.rodriguez@healthcare.com',
        password: 'Doctor123!',
        role: 'doctor',
        specialization: 'Pediatrics',
        isActive: true
      },
      {
        name: 'Dr. James Wilson',
        email: 'james.wilson@healthcare.com',
        password: 'Doctor123!',
        role: 'doctor',
        specialization: 'Orthopedics',
        isActive: true
      },
      {
        name: 'Dr. Lisa Patel',
        email: 'lisa.patel@healthcare.com',
        password: 'Doctor123!',
        role: 'doctor',
        specialization: 'Neurology',
        isActive: true
      }
    ];

    for (const doctorData of doctors) {
      const doctorExists = await User.findOne({ email: doctorData.email });
      
      if (!doctorExists) {
        const hashedPassword = await bcrypt.hash(doctorData.password, 10);
        
        await User.create({
          name: doctorData.name,
          email: doctorData.email,
          password: hashedPassword,
          role: doctorData.role,
          specialization: doctorData.specialization,
          isActive: doctorData.isActive
        });
        
        logger.info(`Doctor ${doctorData.name} created successfully`);
      }
    }
  } catch (error) {
    logger.error(`Error creating sample doctors: ${error}`);
  }
};