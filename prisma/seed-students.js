require('dotenv').config();
const { PrismaClient } = require('../server/node_modules/@prisma/client');

const prisma = new PrismaClient();

const INSTITUTION = 'SIMS College of Pharmacy';
const ACADEMIC_YEAR = '2025-2026';

const COURSES = ['B.Pharm', 'M.Pharm', 'D.Pharm', 'Pharm.D'];
const SEMESTERS = {
  'B.Pharm': ['1st Year', '2nd Year', '3rd Year', '4th Year'],
  'M.Pharm': ['1st Year', '2nd Year'],
  'D.Pharm': ['1st Year', '2nd Year'],
  'Pharm.D': ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year'],
};

const FIRST_NAMES = [
  'Aarav', 'Aisha', 'Arjun', 'Bhavna', 'Chirag', 'Deepa', 'Farhan', 'Geeta',
  'Harsh', 'Ishita', 'Jayesh', 'Kavya', 'Lakshmi', 'Manish', 'Nandini', 'Omkar',
  'Pooja', 'Rahul', 'Sneha', 'Tarun', 'Uma', 'Vikram', 'Wasim', 'Yamini', 'Zara',
  'Abhishek', 'Bhumika', 'Dinesh', 'Ekta', 'Faisal', 'Gurpreet', 'Hema', 'Irfan',
  'Jyoti', 'Kiran', 'Lalit', 'Meera', 'Nikhil', 'Priya', 'Rohan', 'Shruti',
  'Tushar', 'Usha', 'Varun', 'Sunita', 'Yash', 'Zainab', 'Ankita', 'Balaji',
  'Chetna',
];

const LAST_NAMES = [
  'Sharma', 'Patel', 'Reddy', 'Nair', 'Singh', 'Kumar', 'Verma', 'Iyer',
  'Mehta', 'Joshi', 'Rao', 'Pillai', 'Bose', 'Gupta', 'Malhotra', 'Kapoor',
  'Shah', 'Mishra', 'Pandey', 'Tiwari', 'Chauhan', 'Yadav', 'Saxena', 'Srivastava',
  'Agarwal',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const students = [];

  for (let i = 1; i <= 50; i++) {
    const course = pick(COURSES);
    const semester = pick(SEMESTERS[course]);
    const firstName = FIRST_NAMES[i - 1] ?? pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const reg = `SIMS${ACADEMIC_YEAR.replace('-', '').slice(2)}${String(i).padStart(3, '0')}`;

    students.push({
      registration_number: reg,
      student_name: `${firstName} ${lastName}`,
      course,
      semester_or_year: semester,
      academic_year: ACADEMIC_YEAR,
      institution: INSTITUTION,
      status: 'active',
    });
  }

  let created = 0;
  let skipped = 0;

  for (const s of students) {
    const exists = await prisma.student.findUnique({
      where: { registration_number: s.registration_number },
    });

    if (exists) {
      console.log(`  skip  ${s.registration_number} — already exists`);
      skipped++;
      continue;
    }

    await prisma.student.create({ data: s });
    console.log(`  created  ${s.registration_number}  ${s.student_name}  (${s.course}, ${s.semester_or_year})`);
    created++;
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
