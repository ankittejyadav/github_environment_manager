import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GithubEnvManagerComponent } from './github-env-manager.component';

describe('GithubEnvManagerComponent', () => {
  let component: GithubEnvManagerComponent;
  let fixture: ComponentFixture<GithubEnvManagerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [GithubEnvManagerComponent]
    });
    fixture = TestBed.createComponent(GithubEnvManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
