import { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings, Phone, UserPlus, Edit, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DoctorSettings() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Add/Edit Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone_number: ''
  });

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API}/doctors/all`);
      setDoctors(response.data.doctors);
    } catch (error) {
      console.error('Doktorlar yüklenirken hata:', error);
      toast.error('Doktorlar yüklenemedi');
    }
  };

  const openAddDialog = () => {
    setEditingDoctor(null);
    setFormData({ name: '', phone_number: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (doctor) => {
    setEditingDoctor(doctor);
    setFormData({
      name: doctor.name,
      phone_number: doctor.phone_number || ''
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingDoctor(null);
    setFormData({ name: '', phone_number: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Doktor adı zorunludur');
      return;
    }

    setLoading(true);
    try {
      if (editingDoctor) {
        // Update existing doctor
        await axios.put(`${API}/doctors/${editingDoctor.id}`, formData);
        toast.success('Doktor bilgileri güncellendi!');
      } else {
        // Add new doctor
        await axios.post(`${API}/doctors?name=${encodeURIComponent(formData.name)}&phone_number=${encodeURIComponent(formData.phone_number)}`);
        toast.success('Yeni doktor eklendi!');
      }
      
      fetchDoctors();
      closeDialog();
    } catch (error) {
      console.error('İşlem hatası:', error);
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (doctor) => {
    if (!window.confirm(`${doctor.name} doktorunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    setLoading(true);
    try {
      await axios.delete(`${API}/doctors/${doctor.id}`);
      toast.success('Doktor silindi');
      fetchDoctors();
    } catch (error) {
      console.error('Silme hatası:', error);
      toast.error('Doktor silinemedi');
    } finally {
      setLoading(false);
    }
  };


  const handleActivate = async (doctor) => {
    if (!window.confirm(`${doctor.name} doktorunu tekrar aktif hale getirmek istediğinizden emin misiniz?`)) {
      return;
    }

    setLoading(true);
    try {
      await axios.put(`${API}/doctors/${doctor.id}/activate`);
      toast.success('Doktor aktif hale getirildi!');
      fetchDoctors();
    } catch (error) {
      console.error('Aktivasyon hatası:', error);
      toast.error('Doktor aktif edilemedi');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-6" data-testid="doctor-settings">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Settings className="w-5 h-5" />
              Doktor Yönetimi
            </CardTitle>
            <Button
              onClick={openAddDialog}
              className="bg-green-600 hover:bg-green-700"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Yeni Doktor Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded mb-6">
            <p className="text-sm text-blue-900">
              Doktorları ekleyin, düzenleyin veya silin. Silinen doktorların geçmiş istatistikleri korunur.
            </p>
          </div>

          {/* Doctors Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-50">
                  <TableHead>Doktor Adı</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      Henüz doktor eklenmemiş
                    </TableCell>
                  </TableRow>
                ) : (
                  doctors.map((doctor) => (
                    <TableRow key={doctor.id} className="hover:bg-blue-50">
                      <TableCell className="font-medium">{doctor.name}</TableCell>
                      <TableCell>{doctor.phone_number || '-'}</TableCell>
                      <TableCell>
                        {doctor.active ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                            Pasif
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(doctor)}
                          className="border-blue-600 text-blue-600 hover:bg-blue-50"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Düzenle
                        </Button>
                        {doctor.active ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(doctor)}
                            className="border-red-600 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Sil
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleActivate(doctor)}
                            className="border-green-600 text-green-600 hover:bg-green-50"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Aktif Et
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDoctor ? 'Doktor Düzenle' : 'Yeni Doktor Ekle'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="doctor-name">Doktor Adı *</Label>
                <Input
                  id="doctor-name"
                  placeholder="DR ADI SOYADI"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doctor-phone">Telefon Numarası</Label>
                <Input
                  id="doctor-phone"
                  type="tel"
                  placeholder="+90 5XX XXX XX XX"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                İptal
              </Button>
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? 'Kaydediliyor...' : editingDoctor ? 'Güncelle' : 'Ekle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}