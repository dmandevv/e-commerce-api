import { Request, Response } from 'express';
import { User } from '../models/User.js';
import { NotFoundError } from '@ecommerce/shared/errors';

export const addAddress = async (req: Request, res: Response): Promise<void> => {
    const user = await User.findById(req.user?.id);
    if (!user) {
        throw new NotFoundError('User');
    }

    const address = req.body;
    if (address.isDefault) {
        for (let i = 0; i < user.addresses.length; i++) {
            user.addresses[i].isDefault = false;
        }
    }
    user.addresses.push(address);
    await user.save();

    const newAddress = user.addresses[user.addresses.length - 1];
    res.status(201).json({
        success: true,
        data: {
            address: {
                _id: newAddress._id.toString(),
                label: newAddress.label,
                street: newAddress.street,
                city: newAddress.city,
                province: newAddress.province,
                postalCode: newAddress.postalCode,
                country: newAddress.country,
                isDefault: newAddress.isDefault,
            },
        },
    });
}

export const updateAddress = async (req: Request, res: Response): Promise<void> => {
    const user = await User.findById(req.user?.id);
    if (!user) {
        throw new NotFoundError('User');
    }

    const address = user.addresses.find(
        a => a._id.toString() === req.params.addressId
    );
    if (!address) {
        throw new NotFoundError('Address');
    }

    if (req.body.isDefault) {
        for (let i = 0; i < user.addresses.length; i++) {
            user.addresses[i].isDefault = false;
        }
    }
    Object.assign(address, req.body);
    await user.save();

    res.status(200).json({ success: true, data: { address: address } });
}

export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
    const user = await User.findById(req.user?.id);
    if (!user) {
        throw new NotFoundError('User');
    }

    const index = user.addresses.findIndex(
        a => a._id.toString() === req.params.addressId
    );
    if (index === -1) {
        throw new NotFoundError('Address');
    }

    user.addresses.splice(index, 1);
    await user.save();

    res.status(204).end();
}