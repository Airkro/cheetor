export const command = 'test';

export const describe = 'command test';

export const options = [
  ['-f, --force', 'Force mode'],
  ['--level <level>', 'Level', { default: 'basic' }],
];

export function action(argv) {
  console.log(`force=${argv.force} level=${argv.level}`);
}
