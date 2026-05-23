from django import forms
from .models import Record

class RecordForm(forms.ModelForm):
    class Meta:
        model = Record
        fields = [
            'simple_object_name', 'title', 'brief_description', 'donated_loan_by', 'copyright',
            'associated_people', 'associated_places', 'home_location', 'date_received', 
            'current_location', 'physical_description', 'size', 'condition', 'status', 'notes', 'id_number'
        ]
        widgets = {
            'condition': forms.Select(choices=Record.CONDITION_CHOICES),
            'status': forms.Select(choices=Record.STATUS_CHOICES),
        }