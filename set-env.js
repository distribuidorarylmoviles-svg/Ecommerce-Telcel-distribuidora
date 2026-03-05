const { writeFile } = require('fs');
const { promisify } = require('util');

const writeFileAsync = promisify(writeFile);

const targetPath = './src/environments/environment.production.ts';

const supabaseUrl = process.env.SUPABASE_URL || process.env.supabaseUrl || '';
const supabaseKey = process.env.SUPABASE_KEY || process.env.supabaseKey || '';
const stripePublicKey = 'pk_test_51T2cguPm70ZpLbHDAcVQs1tYG69bIr5dRzAUDvIYRBz4u5K1QNaw51hQouqq2IMMINP6fhJ6QDO4JkQVhFOJDxVe00Ld4IO9o0';

const missingVars = [];
if (!supabaseUrl) missingVars.push('SUPABASE_URL (o supabaseUrl)');
if (!supabaseKey) missingVars.push('SUPABASE_KEY (o supabaseKey)');

const isVercelBuild = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

const envConfigFile = `export const environment = {
  production: true,
  apiUrl: '/api',
  supabaseUrl: '${supabaseUrl}',
  supabaseKey: '${supabaseKey}',
  stripePublicKey: '${stripePublicKey}',
};
`;

console.log('Generando el archivo de entorno para producción...');

async function setEnv() {
  if (missingVars.length > 0) {
    if (isVercelBuild) {
      console.error(`ERROR: Faltan variables de entorno en Vercel: ${missingVars.join(', ')}`);
      console.error('Configúralas en Project Settings > Environment Variables y vuelve a desplegar.');
      process.exit(1);
    }
    console.warn('ADVERTENCIA: Las variables de entorno SUPABASE_URL y/o SUPABASE_KEY no están definidas.');
  }
  if (supabaseKey && !supabaseKey.startsWith('eyJ') && !supabaseKey.startsWith('sb_publishable_')) {
    console.warn('ADVERTENCIA: La clave de Supabase parece inválida. Debe iniciar con "eyJ" o "sb_publishable_".');
  }
  await writeFileAsync(targetPath, envConfigFile).catch(err => console.error(err));
  console.log(`Archivo de entorno generado en: ${targetPath}`);
}

setEnv();