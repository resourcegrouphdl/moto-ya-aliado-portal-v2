import { registerLocaleData } from '@angular/common';
import localeEsPe from '@angular/common/locales/es-PE';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Requerido por MtDatePipe (new DatePipe('es-PE')) — sin este registro,
// Angular lanza NG0701 "Missing locale data" en cualquier fecha renderizada.
registerLocaleData(localeEsPe);

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
