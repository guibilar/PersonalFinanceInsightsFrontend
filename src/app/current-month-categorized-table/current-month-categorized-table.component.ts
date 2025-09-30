import {Component, OnInit} from '@angular/core';
import {ReportsRepository} from '../../Repositories/reports-repository';
import {CurrencyPipe} from '@angular/common';
import {LoaderComponent} from '../loader/loader.component';
import {CategoryColorHelper} from '../../Helpers/category-color-helper';

@Component({
  selector: 'app-current-month-categorized-table',
  templateUrl: './current-month-categorized-table.component.html',
  imports: [
    CurrencyPipe,
    LoaderComponent
  ],
  styleUrls: ['./current-month-categorized-table.component.css']
})
export class CurrentMonthCategorizedTableComponent implements OnInit{
  public isLoading: boolean = true;
  public categorizedData: any = [];
  public calculateTotal: number = 0;


  constructor(private reportsRepository: ReportsRepository) {
  }
  ngOnInit(): void {
    this.isLoading = true;

    this.reportsRepository.getCurrentMonthCategorizedGraph().subscribe((response: any) => {
      this.calculateTotal = response.monthlyData[0].total;
      this.categorizedData = response.monthlyData[0].categoryValues;
      this.isLoading = false;
    });
  }

  public getCategoryColor(category:string) : string{
    return CategoryColorHelper.getColor(category)
  }

  protected readonly Object = Object;
}
