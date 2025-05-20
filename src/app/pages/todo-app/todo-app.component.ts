import { Component } from '@angular/core';

@Component({
  selector: 'app-todo-app',
  templateUrl: './todo-app.component.html',
  styleUrls: ['./todo-app.component.scss']
})
export class TodoAppComponent {
  title = 'Todo List';
  items: string[] = ['Item 1', 'Item 2', 'Item 3'];
  newItem: string = '';

  addItem(): void {
    if (this.newItem.trim()) {
      this.items.push(this.newItem);
      this.newItem = '';
    }
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
  }
}
