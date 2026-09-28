import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Flow } from '../../core/models/enums/flow';
import { FlowRuleInputDto } from '../../core/models/inputs/flow-rule-input-dto';
import { FlowRuleOutputDto } from '../../core/models/outputs/flow-rule-output-dto';
import { TEXT_LIMITS } from '../../core/models/text-limits';
import { FLOW_DESCRIPTIONS, FLOW_LABELS, FLOW_RULE_FLOWS } from '../../shared/utils/flow-helper';

const NOT_BLANK = Validators.pattern(/\S/);

/** Which transactions a rule for each flow can apply to. */
const FLOW_RULE_SCOPE: Partial<Record<Flow, string>> = {
  [Flow.Refund]: 'Applies to money in only.',
  [Flow.Income]: 'Applies to money in only.',
  [Flow.Transfer]: 'Applies to money in and out.',
  [Flow.Ignored]: 'Applies to money in and out.',
};

/** Adds or edits a flow rule: a keyword and the flow it sets (anything but Spending). */
@Component({
  selector: 'app-flow-rule-form',
  imports: [ReactiveFormsModule],
  templateUrl: './flow-rule-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowRuleFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly rule = input<FlowRuleOutputDto | null>(null);
  readonly saving = input(false);
  readonly submitRule = output<FlowRuleInputDto>();
  readonly cancelled = output<void>();

  readonly isEditing = computed(() => this.rule() !== null);
  readonly flows = FLOW_RULE_FLOWS;
  readonly flowLabels = FLOW_LABELS;
  readonly maxKeyword = TEXT_LIMITS.flowRuleKeyword;

  readonly form = this.fb.group({
    keyword: ['', [Validators.required, NOT_BLANK, Validators.maxLength(this.maxKeyword)]],
    flow: [Flow.Transfer, Validators.required],
  });

  private readonly flow = toSignal(this.form.controls.flow.valueChanges, {
    initialValue: this.form.controls.flow.value,
  });
  readonly flowHint = computed(
    () => `${FLOW_DESCRIPTIONS[this.flow()]} ${FLOW_RULE_SCOPE[this.flow()] ?? ''}`,
  );

  ngOnInit(): void {
    const rule = this.rule();
    if (rule) {
      this.form.patchValue({ keyword: rule.keyword, flow: rule.flow });
    }
  }

  onSubmit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { keyword, flow } = this.form.getRawValue();
    this.submitRule.emit({ keyword: keyword.trim(), flow });
  }
}
