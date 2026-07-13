import { app } from './app';
import { config } from './config';

let server: any = null;

const PORT = config.PORT;


server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
