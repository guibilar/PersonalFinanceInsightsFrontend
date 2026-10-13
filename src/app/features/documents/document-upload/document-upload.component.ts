import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpEventType } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DocumentRepository } from '../../../core/api/document-repository';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import {
  DocumentDetailsFieldsComponent,
  createDetailsForm,
  detailsOf,
} from '../document-details-fields/document-details-fields.component';
import {
  ACCEPTED_FILES,
  changeError,
  checkFiles,
  formatSize,
  titleFromFileName,
} from '../documents';

/**
 * Adds a document: one or more files (picked, or dropped on the page) and its details. The browser checks the type and
 * size of the files first; the server checks them again and reads the text in the background. After the upload, the
 * document opens.
 */
@Component({
  selector: 'app-document-upload',
  imports: [RouterLink, IconComponent, DocumentDetailsFieldsComponent],
  templateUrl: './document-upload.component.html',
  styleUrl: './document-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentUploadComponent implements OnDestroy {
  private readonly repository = inject(DocumentRepository);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly dataChanges = inject(DataChangesService);

  readonly accept = ACCEPTED_FILES;
  readonly form = createDetailsForm();
  readonly files = signal<File[]>([]);
  readonly problems = computed(() => checkFiles(this.files()));
  readonly dragging = signal(false);

  /** 0 to 100 while the files go up; null when no upload runs. */
  readonly progress = signal<number | null>(null);
  readonly uploading = computed(() => this.progress() !== null);
  /** Why the server refused the last upload. */
  readonly serverError = signal<string | null>(null);

  private upload?: Subscription;

  readonly size = formatSize;

  add(list: ArrayLike<File> | null | undefined): void {
    const added = Array.from(list ?? []);
    if (added.length === 0) return;
    // The same file twice (picked again) is kept once.
    const key = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;
    const known = new Set(this.files().map(key));
    this.files.update((files) => [...files, ...added.filter((file) => !known.has(key(file)))]);
    this.serverError.set(null);
    const title = this.form.controls.title;
    if (!title.value.trim()) title.setValue(titleFromFileName(this.files()[0].name));
  }

  remove(file: File): void {
    this.files.update((files) => files.filter((f) => f !== file));
    this.serverError.set(null);
  }

  onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.add(input.files);
    // The same file can be picked again after a remove.
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    // Leaving for a child of the drop zone is not leaving the zone.
    const zone = event.currentTarget as HTMLElement;
    if (event.relatedTarget instanceof Node && zone.contains(event.relatedTarget)) return;
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.add(event.dataTransfer?.files);
  }

  submit(): void {
    if (this.uploading()) return;
    this.form.markAllAsTouched();
    if (this.files().length === 0 || this.problems().length > 0 || this.form.invalid) return;

    this.serverError.set(null);
    this.progress.set(0);
    this.upload = this.repository.upload(this.files(), detailsOf(this.form)).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.progress.set(Math.round((100 * event.loaded) / event.total));
        } else if (event.type === HttpEventType.Response && event.body) {
          const document = event.body;
          this.progress.set(null);
          this.dataChanges.changed();
          this.toasts.success(`Added “${document.title}”`);
          void this.router.navigate(['/documents', document.id]);
        }
      },
      error: (error: unknown) => {
        this.progress.set(null);
        this.serverError.set(changeError(error, 'Could not upload the document.'));
      },
    });
  }

  cancel(): void {
    this.upload?.unsubscribe();
    this.progress.set(null);
  }

  ngOnDestroy(): void {
    // Leaving the page stops an upload that is still running.
    this.upload?.unsubscribe();
  }
}
