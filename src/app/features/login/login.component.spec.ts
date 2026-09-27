import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let http: HttpTestingController;
  let navigate: jasmine.Spy;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  function submit(returnUrl?: string) {
    if (returnUrl !== undefined) fixture.componentRef.setInput('returnUrl', returnUrl);
    component.form.setValue({ username: 'alex', password: 'secret', rememberMe: true });
    component.onSubmit();
    return http.expectOne({ method: 'POST', url: '/api/Auth/login' });
  }

  it('does not send an empty form', () => {
    component.onSubmit();
    expect(component.form.controls.username.touched).toBeTrue();
  });

  it('signs in and goes back to the page that asked for it', () => {
    const request = submit('/budgets');
    expect(request.request.body).toEqual({
      username: 'alex',
      password: 'secret',
      rememberMe: true,
    });
    expect(component.submitting()).toBeTrue();

    request.flush({ username: 'alex' });

    expect(navigate).toHaveBeenCalledWith('/budgets');
  });

  it('never follows a return URL to another site', () => {
    submit('//evil.example').flush({ username: 'alex' });
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('shows the API message, clears the password and allows another try', async () => {
    submit().flush(
      { detail: 'Incorrect username or password.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await fixture.whenStable();

    expect(component.submitting()).toBeFalse();
    expect(component.form.controls.password.value).toBe('');
    expect(component.form.controls.username.value).toBe('alex');
    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain(
      'Incorrect username or password.',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('explains a lockout', () => {
    submit().flush(
      { detail: 'Too many failed sign-in attempts. Try again in 15 minutes.' },
      { status: 429, statusText: 'Too Many Requests' },
    );
    expect(component.error()).toContain('Too many failed sign-in attempts');
  });

  it('shows and hides the password', async () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#login-password');
    expect(input.type).toBe('password');

    component.showPassword.set(true);
    await fixture.whenStable();

    expect(input.type).toBe('text');
  });
});
