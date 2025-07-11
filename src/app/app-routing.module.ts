import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GithubEnvManagerComponent } from './pages/github-env-manager/github-env-manager.component';

const routes: Routes = [
  { path: '', redirectTo: '/env-manager', pathMatch: 'full' },
  { path: 'env-manager', component: GithubEnvManagerComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
