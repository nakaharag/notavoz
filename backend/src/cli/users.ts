import * as readline from 'readline';
import { openDatabase } from '../db/database.service';
import { DatabaseService } from '../db/database.service';
import { UsersService } from '../auth/users.service';

function readPassword(): Promise<string> {
  if (process.env.NEW_PASSWORD) return Promise.resolve(process.env.NEW_PASSWORD);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, terminal: false });
    rl.once('line', (line) => { rl.close(); resolve(line); });
  });
}

async function main(): Promise<void> {
  const [command, username] = process.argv.slice(2);
  const database = { db: openDatabase() } as DatabaseService;
  const users = new UsersService(database);
  try {
    if (command === 'list') {
      for (const user of users.list()) console.log(`${user.id}\t${user.username}\t${user.disabled ? 'desativado' : 'ativo'}`);
    } else if (command === 'create' && username) {
      await users.create(username, await readPassword());
      console.log(`Usuario criado: ${username}`);
    } else if (command === 'passwd' && username) {
      console.log(await users.setPassword(username, await readPassword()) ? 'Senha atualizada.' : 'Usuario nao encontrado.');
    } else if ((command === 'disable' || command === 'enable') && username) {
      console.log(users.setDisabled(username, command === 'disable') ? 'OK.' : 'Usuario nao encontrado.');
    } else {
      console.log('Uso: node dist/cli/users.js <list | create|passwd|disable|enable <usuario>>\nSenha: variavel NEW_PASSWORD ou primeira linha do stdin.');
      process.exitCode = 2;
    }
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  } finally {
    database.db.close();
  }
}

void main();
