export class CategoryColorHelper {
  // Fixed color map for categories
  private static colorMap: { [key: string]: string } = {
    Dining: '#1F76B5',
    Entertainment: '#FF7E0F',
    Groceries: '#2CA12D',
    Health: '#D72628',
    Other: '#9466BC',
    Pet: '#8C564B',
    Rent: '#E277C3',
    Shopping: '#7F7E7E',
    Subscriptions: '#BDBD23',
    Transportation: '#16BFCF',
    Utilities: '#800080'
  };

  // Get color by category
  public static getColor(category: string): string {
    return this.colorMap[category] || '#CCCCCC'; // Default to grey if category is not in the map
  }
}
