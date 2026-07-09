export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}
