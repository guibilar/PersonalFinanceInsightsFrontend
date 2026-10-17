import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { TaskCountsService } from './task-counts.service';

describe('TaskCountsService', () => {
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        // The end of a session goes to the sign-in page.
        provideRouter([{ path: 'login', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  async function answer(overdue: number): Promise<void> {
    TestBed.tick();
    http
      .expectOne('/api/tasks/summary')
      .flush({ date: '2026-10-14', dueToday: 0, overdue, upcoming: 0 });
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('drops the counts on sign-out, and asks again on the next sign-in', async () => {
    const loaded = auth.ensureLoaded();
    http.expectOne('/api/Auth/me').flush({ username: 'alex' });
    await loaded;
    const counts = TestBed.inject(TaskCountsService);
    await answer(3);
    expect(counts.overdue()).toBe(3);

    // The session ends: the shell goes, this service stays. Nothing to ask while signed out, and nothing left over.
    auth.sessionEnded();
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
    http.expectNone('/api/tasks/summary');
    expect(counts.overdue()).toBe(0);

    auth.login({ username: 'sam', password: 'secret', rememberMe: false }).subscribe();
    http.expectOne('/api/Auth/login').flush({ username: 'sam' });
    await answer(1);
    expect(counts.overdue()).toBe(1);
  });
});
