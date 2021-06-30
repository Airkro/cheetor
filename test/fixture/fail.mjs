import { Cheetor } from '../../index.mjs';

new Cheetor('../../package.json', import.meta.url)
  .commandSafe('../error.js')
  .setup()
  .catch((error) => {
    console.error(error.message,);
  });

new Cheetor('../../package.json', import.meta.url)
  .commandFrom('../error.js')
  .setup()
  .catch((error) => {
    console.error(error.message);
  });

new Cheetor('../../package.json', import.meta.url)
  .commandSmart(() => {
    throw new Error('789');
  })
  .setup()
  .catch((error) => {
    console.error(error.message);
  });
