import apiClient from './apiConfig';

export const productImageService = {
  uploadImage: async (productId: number, file: File) => {
    try {
      const formData = new FormData();
      const dotIndex = file.name.lastIndexOf(".");
      const baseName = dotIndex > 0 ? file.name.slice(0, dotIndex) : file.name;
      const extension = dotIndex > 0 ? file.name.slice(dotIndex) : "";
      const uniqueFilename = `${baseName}-${Date.now()}${extension}`;
      formData.append('image', file, uniqueFilename);

      const response = await apiClient.post(
        `/products/${productId}/upload-image`,
        formData
      );

      return response.data.data;
    } catch (error: any) {
      throw error.response?.data || error;
    }
  },
};
