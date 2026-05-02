import { describe, it, expect, vi } from 'vitest';
import { sanitizeBody } from './index.js';
import type { Request, Response, NextFunction } from 'express';

describe('sanitizeBody middleware', () => {
  it('strips <script> tags from string fields', () => {
    const req = { body: { name: '<script>alert(1)</script>Bob' } } as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    sanitizeBody(req, res, next);

    expect(req.body.name).toBe('Bob');
    expect(next).toHaveBeenCalled();
  });
  it('strips <script> tags from NESTED string fields', () => {
    const req = { 
        body: { 
            name: '<script>alert(1)</script>Bob', 
            nest: {
                name: '<script>hack(1)</script>Jimbo' 
            } 
        } 
    } as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    sanitizeBody(req, res, next);

    expect(req.body.name).toBe('Bob');
    expect(req.body.nest.name).toBe('Jimbo');
    expect(next).toHaveBeenCalled();
  });
  it('strips <script> tags from arrays', () => {
    const req = { 
        body: { 
            array: [
                '<img src=x onerror="alert(1)">Timmy',                            // image with JS event handler
                'Jeff<a href="javascript:alert(1)">click</a>',                   // malicious link
                'Testing<iframe src="https://evil.com"></iframe> Testing 123',  // embedded page
                '<style>body{display:none}</style>'                            // CSS injection
            ]
        }
    } as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    sanitizeBody(req, res, next);

    expect(req.body.array).toHaveLength(4);
    expect(req.body.array[0]).toBe('Timmy');
    expect(req.body.array[1]).toBe('Jeffclick');
    expect(req.body.array[2]).toBe('Testing Testing 123');
    expect(req.body.array[3]).toBe('');
    expect(next).toHaveBeenCalled();
  });
  it('leaves numbers/booleans untouched', () => {
    const req = { 
        body: { 
            number: 5, 
            boolean: true,
            string: 'Hello <b>world</b>'  // tests bold tag removal
        } 
    } as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    sanitizeBody(req, res, next);

    expect(req.body.number).toBe(5);
    expect(req.body.boolean).toBe(true);
    expect(req.body.string).toBe('Hello world');
    expect(next).toHaveBeenCalled();
  });
});
