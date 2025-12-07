import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { UserPlus, CheckCircle, XCircle, Clock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PatientForm({ onPatientAdded }) {
  const [formData, setFormData] = useState({
    visit_date: new Date().toISOString().split('T')[0],
    patient_name: '',
    phone_number: '',
    doctor: '',
    visit_type: '',
    status: '', // "kabul etti", "kabul etmedi", "düşünüyor"
    family_group: '',
    profession_group: '',
    is_revisit: false,
    revisit_date: '',
    notes: ''
  });

  const [selectedStatus, setSelectedStatus] = useState(null); // 'accepted', 'notAccepted', 'thinking'

  const [doctors, setDoctors] = useState([]);
  const [visitTypes, setVisitTypes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDoctors();
    fetchVisitTypes();
  }, []);

  const fetchDoctors = async () => {
    try {
      const response = await axios.get(`${API}/doctors`);
      setDoctors(response.data.doctors);
    } catch (error) {
      console.error('Doktorlar yüklenirken hata:', error);
      toast.error('Doktorlar yüklenemedi');
    }
  };

  const fetchVisitTypes = async () => {
    try {
      const response = await axios.get(`${API}/visit-types`);
      setVisitTypes(response.data.visit_types);
    } catch (error) {
      console.error('Ziyaret tipleri yüklenirken hata:', error);
      toast.error('Ziyaret tipleri yüklenemedi');
    }
  };

  const handleStatusSelect = (status) => {
    setSelectedStatus(status);
    // Map UI status to backend status strings
    if (status === 'accepted') {
      setFormData({ ...formData, status: 'kabul etti' });
    } else if (status === 'notAccepted') {
      setFormData({ ...formData, status: 'kabul etmedi' });
    } else if (status === 'thinking') {
      setFormData({ ...formData, status: 'düşünüyor' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.patient_name || !formData.doctor || !formData.visit_type) {
      toast.error('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (selectedStatus === null) {
      toast.error('Lütfen hasta durumunu seçin');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/patients`, formData);
      toast.success('Hasta başarıyla eklendi!');
      
      if (formData.status === 'düşünüyor' && formData.phone_number && !formData.is_revisit) {
        toast.info('Takip hatırlatması 7 gün sonrası için planlandı');
      }
      
      // Reset form
      setFormData({
        visit_date: new Date().toISOString().split('T')[0],
        patient_name: '',
        phone_number: '',
        doctor: '',
        visit_type: '',
        status: '',
        family_group: '',
        profession_group: '',
        is_revisit: false,
        revisit_date: '',
        notes: ''
      });
      setSelectedStatus(null);

      if (onPatientAdded) {
        onPatientAdded();
      }
    } catch (error) {
      console.error('Hasta eklenirken hata:', error);
      toast.error('Hasta eklenemedi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card data-testid="patient-form">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <UserPlus className="w-5 h-5" />
          Yeni Hasta Ekle
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Visit Date */}
            <div className="space-y-2">
              <Label htmlFor="visit_date">Ziyaret Tarihi *</Label>
              <Input
                id="visit_date"
                type="date"
                value={formData.visit_date}
                onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                required
                data-testid="input-visit-date"
              />
            </div>

            {/* Patient Name */}
            <div className="space-y-2">
              <Label htmlFor="patient_name">Hasta Adı *</Label>
              <Input
                id="patient_name"
                type="text"
                placeholder="Hasta adını girin"
                value={formData.patient_name}
                onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                required
                data-testid="input-patient-name"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone_number">Telefon Numarası</Label>
              <Input
                id="phone_number"
                type="tel"
                placeholder="+90 5XX XXX XX XX"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                data-testid="input-phone-number"
              />
            </div>

            {/* Doctor */}
            <div className="space-y-2">
              <Label htmlFor="doctor">Doktor *</Label>
              <Select
                value={formData.doctor}
                onValueChange={(value) => setFormData({ ...formData, doctor: value })}
                data-testid="select-doctor"
              >
                <SelectTrigger data-testid="select-doctor-trigger">
                  <SelectValue placeholder="Doktor seçin" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor} value={doctor} data-testid={`doctor-option-${doctor}`}>
                      {doctor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Visit Type */}
            <div className="space-y-2">
              <Label htmlFor="visit_type">Ziyaret Tipi *</Label>
              <Select
                value={formData.visit_type}
                onValueChange={(value) => setFormData({ ...formData, visit_type: value })}
                data-testid="select-visit-type"
              >
                <SelectTrigger data-testid="select-visit-type-trigger">
                  <SelectValue placeholder="Ziyaret tipi seçin" />
                </SelectTrigger>
                <SelectContent>
                  {visitTypes.map((type) => (
                    <SelectItem key={type} value={type} data-testid={`visit-type-option-${type}`}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Family Group */}
            <div className="space-y-2">
              <Label htmlFor="family_group">Aile Grubu</Label>
              <Input
                id="family_group"
                type="text"
                placeholder="Aile grubu adı"
                value={formData.family_group}
                onChange={(e) => setFormData({ ...formData, family_group: e.target.value })}
                data-testid="input-family-group"
              />
            </div>

            {/* Profession Group */}
            <div className="space-y-2">
              <Label htmlFor="profession_group">Meslek Grubu</Label>
              <Input
                id="profession_group"
                type="text"
                placeholder="Meslek grubu"
                value={formData.profession_group}
                onChange={(e) => setFormData({ ...formData, profession_group: e.target.value })}
                data-testid="input-profession-group"
              />
            </div>
          </div>

          {/* Patient Status Selection - 3 Modules */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold">Hasta Durumu Seçin *</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Accepted */}
              <div
                onClick={() => handleStatusSelect('accepted')}
                className={`cursor-pointer border-4 rounded-lg p-4 transition-all hover:shadow-lg ${
                  selectedStatus === 'accepted'
                    ? 'border-green-500 bg-green-50'
                    : 'border-green-200 bg-white hover:border-green-400'
                }`}
                data-testid="status-accepted"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className={`w-8 h-8 ${selectedStatus === 'accepted' ? 'text-green-600' : 'text-green-400'}`} />
                  <div>
                    <p className={`font-bold ${selectedStatus === 'accepted' ? 'text-green-700' : 'text-gray-700'}`}>
                      Kabul Edildi
                    </p>
                    <p className="text-xs text-gray-600">Tedavi kabul edildi</p>
                  </div>
                </div>
                {selectedStatus === 'accepted' && (
                  <div className="mt-2 text-center">
                    <span className="inline-block px-3 py-1 bg-green-600 text-white text-xs rounded-full">Seçildi ✓</span>
                  </div>
                )}
              </div>

              {/* Not Accepted */}
              <div
                onClick={() => handleStatusSelect('notAccepted')}
                className={`cursor-pointer border-4 rounded-lg p-4 transition-all hover:shadow-lg ${
                  selectedStatus === 'notAccepted'
                    ? 'border-red-500 bg-red-50'
                    : 'border-red-200 bg-white hover:border-red-400'
                }`}
                data-testid="status-not-accepted"
              >
                <div className="flex items-center gap-3">
                  <XCircle className={`w-8 h-8 ${selectedStatus === 'notAccepted' ? 'text-red-600' : 'text-red-400'}`} />
                  <div>
                    <p className={`font-bold ${selectedStatus === 'notAccepted' ? 'text-red-700' : 'text-gray-700'}`}>
                      Kabul Edilmedi
                    </p>
                    <p className="text-xs text-gray-600">Tedaviyi reddetti</p>
                  </div>
                </div>
                {selectedStatus === 'notAccepted' && (
                  <div className="mt-2 text-center">
                    <span className="inline-block px-3 py-1 bg-red-600 text-white text-xs rounded-full">Seçildi ✓</span>
                  </div>
                )}
              </div>

              {/* Thinking */}
              <div
                onClick={() => handleStatusSelect('thinking')}
                className={`cursor-pointer border-4 rounded-lg p-4 transition-all hover:shadow-lg ${
                  selectedStatus === 'thinking'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-yellow-200 bg-white hover:border-yellow-400'
                }`}
                data-testid="status-thinking"
              >
                <div className="flex items-center gap-3">
                  <Clock className={`w-8 h-8 ${selectedStatus === 'thinking' ? 'text-yellow-600' : 'text-yellow-400'}`} />
                  <div>
                    <p className={`font-bold ${selectedStatus === 'thinking' ? 'text-yellow-700' : 'text-gray-700'}`}>
                      Düşünüyor
                    </p>
                    <p className="text-xs text-gray-600">Karar veriyor</p>
                  </div>
                </div>
                {selectedStatus === 'thinking' && (
                  <div className="mt-2 text-center">
                    <span className="inline-block px-3 py-1 bg-yellow-600 text-white text-xs rounded-full">Seçildi ✓</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Revisit Checkbox */}
          <div className="flex items-center space-x-2">
            <input
              id="is_revisit"
              type="checkbox"
              checked={formData.is_revisit}
              onChange={(e) => setFormData({ ...formData, is_revisit: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300"
              data-testid="checkbox-revisit"
            />
            <Label htmlFor="is_revisit" className="cursor-pointer">
              Tekrar Görüşme
            </Label>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notlar (Opsiyonel)</Label>
            <Textarea
              id="notes"
              placeholder="Ek notlar girin..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              data-testid="textarea-notes"
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={loading}
            data-testid="button-submit-patient"
          >
            {loading ? 'Ekleniyor...' : 'Hasta Ekle'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}