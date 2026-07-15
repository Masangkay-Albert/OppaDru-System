export interface DeliveryPartner {
  _id: string;          
  name: string;           
  email: string;          
  password?: string;      
  phone: string;          
  vehicleType: string; 
  isActive: boolean;     
}