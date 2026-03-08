import dotenv from 'dotenv'
dotenv.config();

import app from './app';

(function (): void {
    try {
        app.listen(process.env.PORT, () => {
            console.log("Listening on port " + process.env.PORT);
        });
    } catch (error) {
        console.log("Could not start the app.");
        process.exit(1);        
    }
})();