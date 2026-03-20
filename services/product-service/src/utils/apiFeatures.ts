import { Query } from 'mongoose';

interface QueryString {
  keyword?: string;
  sort?: string;
  page?: string;
  [key: string]: any;
}

export interface PaginationInfo {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class APIFeatures<T> {
  public query: Query<T[], T>;
  private queryStr: QueryString;
  private _page = 1;
  private _perPage = 8;

  constructor(query: Query<T[], T>, queryStr: QueryString) {
    this.query = query;
    this.queryStr = queryStr;
  }

  search(): this {
    const keyword = this.queryStr.keyword
      ? {
          $or: [
            { name: { $regex: this.queryStr.keyword, $options: 'i' } },
            { description: { $regex: this.queryStr.keyword, $options: 'i' } },
          ],
        }
      : {};

    this.query = this.query.find(keyword as any);
    return this;
  }

  filter(): this {
    const queryCopy = { ...this.queryStr };

    // Remove non-schema fields
    const removeFields = ['keyword', 'sort', 'limit', 'page'];
    removeFields.forEach((field) => delete queryCopy[field]);

    // Add $ prefix for MongoDB operators: price[gte]=100 → price: { $gte: 100 }
    let queryStr = JSON.stringify(queryCopy);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, (match) => `$${match}`);

    this.query = this.query.find(JSON.parse(queryStr));
    return this;
  }

  sort(): this {
    if (this.queryStr.sort) {
      const sortBy = this.queryStr.sort.replace(/,/g, ' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  pagination(resPerPage: number): this {
    this._page = Number(this.queryStr.page) || 1;
    this._perPage = resPerPage;
    const skip = resPerPage * (this._page - 1);

    this.query = this.query.limit(resPerPage).skip(skip);
    return this;
  }

  async getPagination(): Promise<PaginationInfo> {
    const totalCount = await this.query.model.countDocuments(this.query.getFilter());
    const totalPages = Math.ceil(totalCount / this._perPage);

    return {
      page: this._page,
      perPage: this._perPage,
      totalCount,
      totalPages,
      hasNext: this._page < totalPages,
      hasPrev: this._page > 1,
    };
  }
}
