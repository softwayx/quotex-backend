import { created, ok } from '../../../utils/apiResponse.js';
import * as service from './blogs.service.js';

export const list = async (req, res) => ok(res, await service.listForAdmin(req.query));

export const detail = async (req, res) => ok(res, await service.getForAdmin(req.params.id));

export const create = async (req, res) => created(res, await service.createPost(req.admin, req.body));

export const update = async (req, res) => ok(res, await service.updatePost(req.admin, req.params.id, req.body));

export const setStatus = async (req, res) => ok(res, await service.setPostStatus(req.admin, req.params.id, req.body.status));

export const remove = async (req, res) => ok(res, await service.deletePost(req.admin, req.params.id));

export const uploadImage = async (req, res) => created(res, await service.uploadBlogImage(req.file));
