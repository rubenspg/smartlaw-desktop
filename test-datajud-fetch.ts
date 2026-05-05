import { DatajudService } from './apps/server/src/services/DatajudService';
async function test() {
  try {
    const data = await DatajudService.fetchFromDatajud("1000000-00.2023.8.26.0000");
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}
test();
